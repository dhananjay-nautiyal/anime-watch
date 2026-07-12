package com.animeSite.importpipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.JikanListResponse;
import com.animeSite.persist.*;
import com.animeSite.persist.ImportJob.ImportStatus;
import com.animeSite.persist.ImportLog.ImportRecordStatus;
import com.animeSite.repo.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
public class ImportPipelineService {

    private static final Logger log = LoggerFactory.getLogger(ImportPipelineService.class);
    private static final int BATCH_SIZE = 25;
    private static final int MAX_CONCURRENT = 3;

    private final MetadataProvider metadataProvider;
    private final JikanApiClient jikanApiClient;
    private final AnimeRepository animeRepository;
    private final AnimeGenreRepository genreRepository;
    private final AnimeStudioRepository studioRepository;
    private final AnimeProducerRepository producerRepository;
    private final AnimeLicensorRepository licensorRepository;
    private final AnimeTagRepository tagRepository;
    private final AnimeCharacterRepository characterRepository;
    private final AnimeStaffRepository staffRepository;
    private final RelatedAnimeRepository relatedAnimeRepository;
    private final AnimeRecommendationRepository recommendationRepository;
    private final AnimeExternalIdRepository externalIdRepository;
    private final AnimeThemeRepository themeRepository;
    private final ImportJobRepository importJobRepository;
    private final ImportLogRepository importLogRepository;
    private final TransactionTemplate transactionTemplate;

    private final ExecutorService executor = Executors.newFixedThreadPool(MAX_CONCURRENT);
    private volatile ImportJob currentJob;
    private volatile boolean cancelled = false;

    public ImportPipelineService(MetadataProvider metadataProvider,
                                  JikanApiClient jikanApiClient,
                                  AnimeRepository animeRepository,
                                  AnimeGenreRepository genreRepository,
                                  AnimeStudioRepository studioRepository,
                                  AnimeProducerRepository producerRepository,
                                  AnimeLicensorRepository licensorRepository,
                                  AnimeTagRepository tagRepository,
                                  AnimeCharacterRepository characterRepository,
                                  AnimeStaffRepository staffRepository,
                                  RelatedAnimeRepository relatedAnimeRepository,
                                  AnimeRecommendationRepository recommendationRepository,
                                  AnimeExternalIdRepository externalIdRepository,
                                  AnimeThemeRepository themeRepository,
                                  ImportJobRepository importJobRepository,
                                  ImportLogRepository importLogRepository,
                                  TransactionTemplate transactionTemplate) {
        this.metadataProvider = metadataProvider;
        this.jikanApiClient = jikanApiClient;
        this.animeRepository = animeRepository;
        this.genreRepository = genreRepository;
        this.studioRepository = studioRepository;
        this.producerRepository = producerRepository;
        this.licensorRepository = licensorRepository;
        this.tagRepository = tagRepository;
        this.characterRepository = characterRepository;
        this.staffRepository = staffRepository;
        this.relatedAnimeRepository = relatedAnimeRepository;
        this.recommendationRepository = recommendationRepository;
        this.externalIdRepository = externalIdRepository;
        this.themeRepository = themeRepository;
        this.importJobRepository = importJobRepository;
        this.importLogRepository = importLogRepository;
        this.transactionTemplate = transactionTemplate;
    }

    // --- Public API ---

    public ImportJob importByMalIds(List<Integer> malIds) {
        ImportJob job = createJob("MAL_ID_LIST", "{\"malIds\": " + malIds + "}", malIds.size());
        executeJob(job, progress -> processBatch(job, malIds));
        return job;
    }

    public ImportJob importTrending(int pages) {
        ImportJob job = createJob("TRENDING", "{\"pages\": " + pages + "}", null);
        executeJob(job, progress -> {
            List<Integer> allIds = new ArrayList<>();
            for (int p = 0; p < pages; p++) {
                try {
                    JikanListResponse resp = jikanApiClient.fetchTopAnime(p);
                    if (resp != null && resp.getData() != null) {
                        resp.getData().forEach(d -> allIds.add(d.getMalId()));
                    }
                } catch (Exception e) {
                    log.warn("Failed to fetch trending page {}: {}", p, e.getMessage());
                }
            }
            processBatch(job, allIds);
        });
        return job;
    }

    public ImportJob importSeasonal(int pages) {
        ImportJob job = createJob("SEASONAL", "{\"pages\": " + pages + "}", null);
        executeJob(job, progress -> {
            List<Integer> allIds = new ArrayList<>();
            for (int p = 0; p < pages; p++) {
                try {
                    JikanListResponse resp = jikanApiClient.fetchSeasonalAnime(p);
                    if (resp != null && resp.getData() != null) {
                        resp.getData().forEach(d -> allIds.add(d.getMalId()));
                    }
                } catch (Exception e) {
                    log.warn("Failed to fetch seasonal page {}: {}", p, e.getMessage());
                }
            }
            processBatch(job, allIds);
        });
        return job;
    }

    public ImportJob importFullCatalog() {
        ImportJob job = createJob("FULL", "{\"type\": \"full_catalog\"}", null);
        executeJob(job, progress -> {
            List<Integer> allIds = new ArrayList<>();
            // Fetch top anime across multiple pages
            for (int p = 0; p < 10; p++) {
                try {
                    JikanListResponse resp = jikanApiClient.fetchTopAnime(p);
                    if (resp != null && resp.getData() != null) {
                        resp.getData().forEach(d -> allIds.add(d.getMalId()));
                    }
                    if (resp == null || resp.getPagination() == null || !resp.getPagination().isHasNextPage()) break;
                } catch (Exception e) {
                    log.warn("Failed to fetch top anime page {}: {}", p, e.getMessage());
                }
            }
            // Fetch seasonal anime
            for (int p = 0; p < 5; p++) {
                try {
                    JikanListResponse resp = jikanApiClient.fetchSeasonalAnime(p);
                    if (resp != null && resp.getData() != null) {
                        resp.getData().forEach(d -> allIds.add(d.getMalId()));
                    }
                    if (resp == null || resp.getPagination() == null || !resp.getPagination().isHasNextPage()) break;
                } catch (Exception e) {
                    log.warn("Failed to fetch seasonal page {}: {}", p, e.getMessage());
                }
            }
            processBatch(job, allIds.stream().distinct().toList());
        });
        return job;
    }

    public ImportJob importAllByMalIds(List<Integer> malIds) {
        return importByMalIds(malIds);
    }

    // --- Job management ---

    public void cancelCurrentJob() {
        this.cancelled = true;
        if (currentJob != null) {
            currentJob.setStatus(ImportStatus.CANCELLED);
            currentJob.setCompletedAt(LocalDateTime.now());
            importJobRepository.save(currentJob);
        }
    }

    public Optional<ImportJob> getRunningJob() {
        return importJobRepository.findTopByStatusOrderByCreatedAtDesc(ImportStatus.RUNNING);
    }

    public List<ImportJob> getRecentJobs() {
        return importJobRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<ImportLog> getJobLogs(UUID jobId) {
        return importLogRepository.findByJobIdOrderByCreatedAtDesc(jobId);
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalAnime", animeRepository.count());
        stats.put("lastImport", importJobRepository.findAllByOrderByCreatedAtDesc().stream().findFirst()
            .map(ImportJob::getCompletedAt).orElse(null));
        stats.put("failedJobs", importJobRepository.findByStatusOrderByCreatedAtDesc(ImportStatus.FAILED).size());
        stats.put("runningJobs", importJobRepository.findByStatusOrderByCreatedAtDesc(ImportStatus.RUNNING).size());
        return stats;
    }

    // --- Internal pipeline ---

    private ImportJob createJob(String type, String parameters, Integer totalItems) {
        ImportJob job = new ImportJob();
        job.setType(type);
        job.setStatus(ImportStatus.PENDING);
        job.setParameters(parameters);
        job.setTotalItems(totalItems);
        job.setProcessedItems(0);
        job.setSuccessCount(0);
        job.setFailCount(0);
        job.setSkipCount(0);
        return importJobRepository.save(job);
    }

    private void executeJob(ImportJob job, Consumer<Void> work) {
        this.currentJob = job;
        this.cancelled = false;
        job.setStatus(ImportStatus.RUNNING);
        job.setStartedAt(LocalDateTime.now());
        importJobRepository.save(job);

        executor.submit(() -> {
            try {
                work.accept(null);
                if (!cancelled) {
                    job.setStatus(ImportStatus.COMPLETED);
                }
            } catch (Exception e) {
                log.error("Import job {} failed: {}", job.getId(), e.getMessage(), e);
                job.setStatus(ImportStatus.FAILED);
                job.setErrorMessage(e.getMessage());
            } finally {
                job.setCompletedAt(LocalDateTime.now());
                importJobRepository.save(job);
                this.currentJob = null;
            }
        });
    }

    private void processBatch(ImportJob job, List<Integer> malIds) {
        if (malIds.isEmpty()) {
            job.setTotalItems(0);
            importJobRepository.save(job);
            return;
        }
        job.setTotalItems(malIds.size());
        job.setProcessedItems(0);
        importJobRepository.save(job);

        // Process in batches to avoid overwhelming memory
        for (int i = 0; i < malIds.size(); i += BATCH_SIZE) {
            if (cancelled) break;
            int end = Math.min(i + BATCH_SIZE, malIds.size());
            List<Integer> batch = malIds.subList(i, end);
            processSingleBatch(job, batch);
        }
    }

    private void processSingleBatch(ImportJob job, List<Integer> batch) {
        // Check existing records
        List<Anime> existingList = animeRepository.findAllByMalIdIn(batch);
        Set<Integer> existingMalIds = existingList.stream()
            .map(Anime::getMalId)
            .collect(Collectors.toSet());

        for (Integer malId : batch) {
            if (cancelled) break;
            long start = System.currentTimeMillis();
            try {
                boolean exists = existingMalIds.contains(malId);
                ImportRecordStatus status = importSingleAnime(malId, exists);
                long elapsed = System.currentTimeMillis() - start;

                ImportLog logEntry = new ImportLog();
                logEntry.setJob(job);
                logEntry.setMalId(malId);
                logEntry.setStatus(status);
                logEntry.setDurationMs(elapsed);
                importLogRepository.save(logEntry);

                job.setProcessedItems(job.getProcessedItems() + 1);
                if (status == ImportRecordStatus.SUCCESS) {
                    job.setSuccessCount(job.getSuccessCount() + 1);
                } else if (status == ImportRecordStatus.SKIPPED) {
                    job.setSkipCount(job.getSkipCount() + 1);
                } else {
                    job.setFailCount(job.getFailCount() + 1);
                }
                importJobRepository.save(job);

            } catch (Exception e) {
                log.error("Failed to import malId {}: {}", malId, e.getMessage());
                long elapsed = System.currentTimeMillis() - start;
                ImportLog logEntry = new ImportLog();
                logEntry.setJob(job);
                logEntry.setMalId(malId);
                logEntry.setStatus(ImportRecordStatus.FAILED);
                logEntry.setErrorMessage(e.getMessage());
                logEntry.setDurationMs(elapsed);
                importLogRepository.save(logEntry);

                job.setProcessedItems(job.getProcessedItems() + 1);
                job.setFailCount(job.getFailCount() + 1);
                importJobRepository.save(job);
            }
        }
    }

    @Transactional
    public ImportRecordStatus importSingleAnime(int malId, boolean exists) {
        // Fetch full metadata
        MetadataProvider.FullAnimeMetadata meta = metadataProvider.fetchFullMetadata(malId);
        if (meta.anime() == null || meta.anime().getMalId() == null) {
            return ImportRecordStatus.FAILED;
        }

        // Validate
        String validationError = validate(meta.anime());
        if (validationError != null) {
            log.warn("Validation failed for malId {}: {}", malId, validationError);
            return ImportRecordStatus.FAILED;
        }

        // Normalize
        normalize(meta.anime());

        // Find existing record
        Optional<Anime> existingOpt = animeRepository.findByMalId(malId);
        if (existingOpt.isPresent()) {
            Anime existing = existingOpt.get();
            // Don't overwrite if existing was imported more recently
            if (existing.getImportedAt() != null && meta.anime().getImportedAt() != null
                && existing.getImportedAt().isAfter(meta.anime().getImportedAt())) {
                return ImportRecordStatus.SKIPPED;
            }
            // Merge: update fields but keep ID, slug, affiliateUrl, and manual overrides
            mergeAnime(existing, meta);
            saveFullAnime(existing, meta);
        } else {
            // New record
            Anime anime = meta.anime();
            saveFullAnime(anime, meta);
        }

        return ImportRecordStatus.SUCCESS;
    }

    private String validate(Anime anime) {
        if (anime.getMalId() == null) return "malId is required";
        if (anime.getTitle() == null || anime.getTitle().isBlank()) return "title is required";
        if (anime.getScore() != null && (anime.getScore() < 0 || anime.getScore() > 10)) return "score out of range";
        return null;
    }

    private void normalize(Anime anime) {
        // Normalize type
        if (anime.getType() != null) {
            anime.setType(anime.getType().toUpperCase());
        }
        // Normalize status
        if (anime.getStatus() != null) {
            String s = anime.getStatus().toLowerCase().replace('_', ' ');
            switch (s) {
                case "currently airing" -> anime.setStatus("Currently Airing");
                case "finished airing" -> anime.setStatus("Finished Airing");
                case "not yet aired" -> anime.setStatus("Not Yet Aired");
                default -> anime.setStatus(anime.getStatus());
            }
        }
        // Normalize season
        if (anime.getSeason() != null) {
            anime.setSeason(anime.getSeason().toLowerCase());
        }
    }

    private void mergeAnime(Anime existing, MetadataProvider.FullAnimeMetadata meta) {
        Anime fresh = meta.anime();
        // Keep existing ID, slug, affiliateUrl, createdAt
        fresh.setId(existing.getId());
        if (existing.getSlug() != null) fresh.setSlug(existing.getSlug());
        if (existing.getAffiliateUrl() != null) fresh.setAffiliateUrl(existing.getAffiliateUrl());
        fresh.setCreatedAt(existing.getCreatedAt());
        // If fresh has no score but existing does, keep existing
        if (fresh.getScore() == null && existing.getScore() != null) {
            fresh.setScore(existing.getScore());
        }
        // If fresh has null for a field that existing has populated, keep existing
        if (fresh.getImageUrl() == null && existing.getImageUrl() != null) fresh.setImageUrl(existing.getImageUrl());
        if (fresh.getSynopsis() == null && existing.getSynopsis() != null) fresh.setSynopsis(existing.getSynopsis());
    }

    @Transactional
    protected void saveFullAnime(Anime anime, MetadataProvider.FullAnimeMetadata meta) {
        // Resolve many-to-many relations (find existing or create new)
        anime.setAnimeGenres(resolveGenres(meta.genres()));
        anime.setAnimeStudios(resolveStudios(meta.studios()));
        anime.setAnimeProducers(resolveProducers(meta.producers()));
        anime.setAnimeLicensors(resolveLicensors(meta.licensors()));
        anime.setAnimeTags(resolveTags(meta.tags()));
        anime.setAnimeCharacters(resolveCharacters(meta.characters()));
        anime.setAnimeStaff(resolveStaff(meta.staff()));

        // Save anime first to get ID
        Anime saved = animeRepository.save(anime);

        // Save one-to-many relations that need the anime ID
        saveRelatedAnime(saved, meta.relatedAnime());
        saveExternalIds(saved, meta.externalIds());
        saveThemes(saved, meta.themes());
        saveRecommendations(saved, meta.recommendations());
    }

    private List<AnimeGenre> resolveGenres(List<AnimeGenre> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        List<Integer> malIds = incoming.stream().map(AnimeGenre::getMalId).toList();
        List<AnimeGenre> existing = genreRepository.findAllByMalIdIn(malIds);
        Map<Integer, AnimeGenre> existingMap = existing.stream()
            .collect(Collectors.toMap(AnimeGenre::getMalId, g -> g));
        return incoming.stream()
            .map(g -> existingMap.getOrDefault(g.getMalId(), g))
            .toList();
    }

    private List<AnimeStudio> resolveStudios(List<AnimeStudio> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        List<Integer> malIds = incoming.stream().map(AnimeStudio::getMalId).toList();
        List<AnimeStudio> existing = studioRepository.findAllByMalIdIn(malIds);
        Map<Integer, AnimeStudio> existingMap = existing.stream()
            .collect(Collectors.toMap(AnimeStudio::getMalId, s -> s));
        return incoming.stream()
            .map(s -> existingMap.getOrDefault(s.getMalId(), s))
            .toList();
    }

    private List<AnimeProducer> resolveProducers(List<AnimeProducer> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        List<Integer> malIds = incoming.stream().map(AnimeProducer::getMalId).toList();
        List<AnimeProducer> existing = producerRepository.findAllByMalIdIn(malIds);
        Map<Integer, AnimeProducer> existingMap = existing.stream()
            .collect(Collectors.toMap(AnimeProducer::getMalId, p -> p));
        return incoming.stream()
            .map(p -> existingMap.getOrDefault(p.getMalId(), p))
            .toList();
    }

    private List<AnimeLicensor> resolveLicensors(List<AnimeLicensor> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        List<Integer> malIds = incoming.stream().map(AnimeLicensor::getMalId).toList();
        List<AnimeLicensor> existing = licensorRepository.findAllByMalIdIn(malIds);
        Map<Integer, AnimeLicensor> existingMap = existing.stream()
            .collect(Collectors.toMap(AnimeLicensor::getMalId, l -> l));
        return incoming.stream()
            .map(l -> existingMap.getOrDefault(l.getMalId(), l))
            .toList();
    }

    private List<AnimeTag> resolveTags(List<AnimeTag> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        return incoming.stream().map(t -> {
            try {
                return tagRepository.findByName(t.getName()).orElse(t);
            } catch (Exception e) {
                return t;
            }
        }).toList();
    }

    private List<AnimeCharacter> resolveCharacters(List<AnimeCharacter> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        return incoming.stream().map(c -> {
            try {
                return characterRepository.findByMalId(c.getMalId()).orElse(c);
            } catch (Exception e) {
                return c;
            }
        }).toList();
    }

    private List<AnimeStaff> resolveStaff(List<AnimeStaff> incoming) {
        if (incoming == null || incoming.isEmpty()) return new ArrayList<>();
        return new ArrayList<>(incoming);
    }

    private void saveRelatedAnime(Anime anime, List<RelatedAnime> list) {
        if (list == null || list.isEmpty()) return;
        list.forEach(r -> r.setAnime(anime));
        relatedAnimeRepository.saveAll(list);
    }

    private void saveExternalIds(Anime anime, List<AnimeExternalId> list) {
        if (list == null || list.isEmpty()) return;
        list.forEach(e -> e.setAnime(anime));
        externalIdRepository.saveAll(list);
    }

    private void saveThemes(Anime anime, List<AnimeTheme> list) {
        if (list == null || list.isEmpty()) return;
        list.forEach(t -> t.setAnime(anime));
        themeRepository.saveAll(list);
    }

    private void saveRecommendations(Anime anime, List<AnimeRecommendation> list) {
        if (list == null || list.isEmpty()) return;
        list.forEach(r -> r.setAnime(anime));
        recommendationRepository.saveAll(list);
    }
}
