package com.animeSite.importpipeline;

import com.animeSite.httpclient.JikanApiClient;
import com.animeSite.model.*;
import com.animeSite.persist.*;
import com.animeSite.service.SlugService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JikanMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(JikanMetadataProvider.class);

    private final JikanApiClient jikanApiClient;
    private final SlugService slugService;

    public JikanMetadataProvider(JikanApiClient jikanApiClient, SlugService slugService) {
        this.jikanApiClient = jikanApiClient;
        this.slugService = slugService;
    }

    @Override
    public FullAnimeMetadata fetchFullMetadata(int malId) {
        JikanFullAnimeResponse fullResponse = jikanApiClient.fetchAnimeFull(malId);
        if (fullResponse == null || fullResponse.getData() == null) {
            throw new RuntimeException("No data returned from Jikan for malId: " + malId);
        }

        JikanFullAnimeData data = fullResponse.getData();
        Anime anime = mapAnime(data);

        List<AnimeGenre> genres = mapGenres(data.getGenres());
        List<AnimeStudio> studios = mapStudios(data.getStudios());
        List<AnimeProducer> producers = mapProducers(data.getProducers());
        List<AnimeLicensor> licensors = mapLicensors(data.getLicensors());
        List<AnimeTag> tags = mapTags(data.getTags());
        List<AnimeTheme> themes = mapThemes(anime, data.getThemes());
        List<RelatedAnime> related = mapRelated(anime, data.getRelations());
        List<AnimeExternalId> externalIds = mapExternalIds(anime, data.getExternal(), data.getStreaming());

        // Fetch supplementary data from secondary endpoints
        List<AnimeCharacter> characters = fetchCharacters(malId, anime);
        List<AnimeStaff> staff = fetchStaff(malId, anime);
        List<AnimeRecommendation> recommendations = fetchRecommendations(malId, anime);

        return new FullAnimeMetadata(anime, genres, studios, producers, licensors,
            tags, characters, staff, related, recommendations, externalIds, themes);
    }

    public Anime mapAnimeOnly(JikanFullAnimeData data) {
        return mapAnime(data);
    }

    private Anime mapAnime(JikanFullAnimeData data) {
        Anime anime = new Anime();
        anime.setMalId(data.getMalId());
        String englishTitle = data.getTitleEnglish();
        String title = englishTitle != null && !englishTitle.isBlank() ? englishTitle : data.getTitle();
        anime.setTitle(title);
        anime.setTitleEnglish(data.getTitleEnglish());
        anime.setTitleJapanese(data.getTitleJapanese());
        if (data.getTitleSynonyms() != null && !data.getTitleSynonyms().isEmpty()) {
            anime.setTitleSynonyms(String.join(", ", data.getTitleSynonyms()));
        }
        String rawSlug = slugService.generateSlug(title);
        anime.setSlug(slugService.ensureUniqueSlug(rawSlug, data.getMalId()));

        anime.setSynopsis(data.getSynopsis());
        anime.setBackground(data.getBackground());
        anime.setScore(data.getScore());
        anime.setRank(data.getRank());
        anime.setPopularity(data.getPopularity());
        anime.setMembers(data.getMembers());
        anime.setFavorites(data.getFavorites());
        anime.setRating(data.getRating());
        anime.setEpisodes(data.getEpisodes());
        anime.setType(data.getType());
        anime.setStatus(data.getStatus());
        anime.setYear(data.getYear());
        anime.setSeason(data.getSeason());
        anime.setDuration(data.getDuration());
        anime.setSource(data.getSource());
        anime.setMalUrl(data.getUrl());

        if (data.getAired() != null) {
            anime.setAired(data.getAired().getAiredString());
        }
        if (data.getTrailer() != null) {
            anime.setTrailerUrl(data.getTrailer().getUrl());
            anime.setTrailerEmbedUrl(data.getTrailer().getEmbedUrl());
        }
        if (data.getImages() != null && data.getImages().getJpg() != null) {
            JikanAnimeData.Jpg jpg = data.getImages().getJpg();
            anime.setImageUrl(jpg.getLargeImageUrl() != null ? jpg.getLargeImageUrl() : jpg.getImageUrl());
        }
        if (data.getImages() != null && data.getImages().getWebp() != null) {
            JikanAnimeData.Webp webp = data.getImages().getWebp();
            anime.setBannerUrl(webp.getLargeImageUrl() != null ? webp.getLargeImageUrl() : webp.getImageUrl());
        }
        anime.setImportedAt(LocalDateTime.now());
        return anime;
    }

    private List<AnimeGenre> mapGenres(List<JikanAnimeData.Genre> genreList) {
        if (genreList == null) return List.of();
        return genreList.stream().map(g -> {
            AnimeGenre ag = new AnimeGenre();
            ag.setMalId(g.getMalId());
            ag.setName(g.getName());
            ag.setType(g.getType());
            return ag;
        }).toList();
    }

    private List<AnimeStudio> mapStudios(List<JikanAnimeData.Studio> studioList) {
        if (studioList == null) return List.of();
        return studioList.stream().map(s -> {
            AnimeStudio as = new AnimeStudio();
            as.setMalId(s.getMalId());
            as.setName(s.getName());
            return as;
        }).toList();
    }

    private List<AnimeProducer> mapProducers(List<JikanAnimeData.Producer> producerList) {
        if (producerList == null) return List.of();
        return producerList.stream().map(p -> {
            AnimeProducer ap = new AnimeProducer();
            ap.setMalId(p.getMalId());
            ap.setName(p.getName());
            return ap;
        }).toList();
    }

    private List<AnimeLicensor> mapLicensors(List<JikanAnimeData.Licensor> licensorList) {
        if (licensorList == null) return List.of();
        return licensorList.stream().map(l -> {
            AnimeLicensor al = new AnimeLicensor();
            al.setMalId(l.getMalId());
            al.setName(l.getName());
            return al;
        }).toList();
    }

    private List<AnimeTag> mapTags(List<JikanFullAnimeData.Tag> tagList) {
        if (tagList == null) return List.of();
        return tagList.stream().map(t -> {
            AnimeTag at = new AnimeTag();
            at.setName(t.getName());
            at.setWeight(t.getWeight());
            return at;
        }).toList();
    }

    private List<AnimeTheme> mapThemes(Anime anime, List<JikanFullAnimeData.Theme> themeList) {
        if (themeList == null) return List.of();
        return themeList.stream().map(t -> {
            AnimeTheme at = new AnimeTheme();
            at.setAnime(anime);
            at.setType(t.getType());
            at.setText(t.getText());
            return at;
        }).toList();
    }

    private List<RelatedAnime> mapRelated(Anime anime, List<JikanFullAnimeData.Relation> relations) {
        if (relations == null) return List.of();
        List<RelatedAnime> result = new ArrayList<>();
        for (JikanFullAnimeData.Relation rel : relations) {
            if (rel.getEntry() != null) {
                for (JikanFullAnimeData.RelationEntry entry : rel.getEntry()) {
                    RelatedAnime ra = new RelatedAnime();
                    ra.setAnime(anime);
                    ra.setRelationType(rel.getRelation());
                    ra.setRelatedMalId(entry.getMalId());
                    ra.setRelatedTitle(entry.getName());
                    result.add(ra);
                }
            }
        }
        return result;
    }

    private List<AnimeExternalId> mapExternalIds(Anime anime, List<JikanFullAnimeData.External> external,
                                                  List<JikanFullAnimeData.Streaming> streaming) {
        List<AnimeExternalId> result = new ArrayList<>();
        if (external != null) {
            for (JikanFullAnimeData.External ext : external) {
                AnimeExternalId e = new AnimeExternalId();
                e.setAnime(anime);
                e.setSite(ext.getName());
                e.setUrl(ext.getUrl());
                result.add(e);
            }
        }
        if (streaming != null) {
            for (JikanFullAnimeData.Streaming s : streaming) {
                AnimeExternalId e = new AnimeExternalId();
                e.setAnime(anime);
                e.setSite(s.getName());
                e.setUrl(s.getUrl());
                result.add(e);
            }
        }
        return result;
    }

    private List<AnimeCharacter> fetchCharacters(int malId, Anime anime) {
        try {
            JikanCharactersResponse resp = jikanApiClient.fetchAnimeCharacters(malId);
            if (resp == null || resp.getData() == null) return List.of();
            return resp.getData().stream().map(cd -> {
                AnimeCharacter ac = new AnimeCharacter();
                ac.setMalId(cd.getCharacter().getMalId());
                ac.setName(cd.getCharacter().getName());
                ac.setRole(cd.getRole());
                if (cd.getCharacter().getImages() != null && cd.getCharacter().getImages().getJpg() != null) {
                    ac.setImageUrl(cd.getCharacter().getImages().getJpg().getImageUrl());
                }
                return ac;
            }).toList();
        } catch (Exception e) {
            log.warn("Failed to fetch characters for malId {}: {}", malId, e.getMessage());
            return List.of();
        }
    }

    private List<AnimeStaff> fetchStaff(int malId, Anime anime) {
        try {
            JikanStaffResponse resp = jikanApiClient.fetchAnimeStaff(malId);
            if (resp == null || resp.getData() == null) return List.of();
            return resp.getData().stream().flatMap(sd -> {
                String name = sd.getPerson().getName();
                int personMalId = sd.getPerson().getMalId();
                String imageUrl = sd.getPerson().getImages() != null && sd.getPerson().getImages().getJpg() != null
                    ? sd.getPerson().getImages().getJpg().getImageUrl() : null;
                if (sd.getPositions() == null || sd.getPositions().isEmpty()) {
                    AnimeStaff s = new AnimeStaff();
                    s.setMalId(personMalId);
                    s.setName(name);
                    s.setImageUrl(imageUrl);
                    s.setRole("Staff");
                    return java.util.stream.Stream.of(s);
                }
                return sd.getPositions().stream().map(pos -> {
                    AnimeStaff s = new AnimeStaff();
                    s.setMalId(personMalId);
                    s.setName(name);
                    s.setImageUrl(imageUrl);
                    s.setRole(pos);
                    return s;
                });
            }).toList();
        } catch (Exception e) {
            log.warn("Failed to fetch staff for malId {}: {}", malId, e.getMessage());
            return List.of();
        }
    }

    private List<AnimeRecommendation> fetchRecommendations(int malId, Anime anime) {
        try {
            JikanRecommendationsResponse resp = jikanApiClient.fetchAnimeRecommendations(malId);
            if (resp == null || resp.getData() == null) return List.of();
            return resp.getData().stream().map(rd -> {
                AnimeRecommendation ar = new AnimeRecommendation();
                ar.setAnime(anime);
                ar.setMalId(rd.getEntry().getMalId());
                ar.setTitle(rd.getEntry().getTitle());
                ar.setVotes(rd.getVotes());
                if (rd.getEntry().getImages() != null && rd.getEntry().getImages().getJpg() != null) {
                    ar.setImageUrl(rd.getEntry().getImages().getJpg().getImageUrl());
                }
                return ar;
            }).toList();
        } catch (Exception e) {
            log.warn("Failed to fetch recommendations for malId {}: {}", malId, e.getMessage());
            return List.of();
        }
    }
}
