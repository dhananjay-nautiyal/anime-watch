package com.animeSite.controller;

import com.animeSite.core.model.ApiResponse;
import com.animeSite.importpipeline.ImportPipelineService;
import com.animeSite.persist.ImportJob;
import com.animeSite.persist.ImportLog;
import com.animeSite.repo.ImportJobRepository;
import com.animeSite.repo.ImportLogRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/import")
@Tag(name = "Import Admin", description = "Anime catalog import management endpoints")
public class ImportAdminController {

    private final ImportPipelineService importPipelineService;
    private final ImportJobRepository importJobRepository;
    private final ImportLogRepository importLogRepository;

    public ImportAdminController(ImportPipelineService importPipelineService,
                                  ImportJobRepository importJobRepository,
                                  ImportLogRepository importLogRepository) {
        this.importPipelineService = importPipelineService;
        this.importJobRepository = importJobRepository;
        this.importLogRepository = importLogRepository;
    }

    @PostMapping("/start")
    @Operation(summary = "Start a new import job",
        description = "Starts an import of type: full, trending (n), seasonal (n), or by MAL IDs (malIds=1,2,3)")
    public ResponseEntity<ApiResponse<ImportJob>> startImport(@RequestBody Map<String, Object> params) {
        String type = (String) params.getOrDefault("type", "trending");
        ImportJob job;

        switch (type) {
            case "full" -> job = importPipelineService.importFullCatalog();
            case "trending" -> {
                int pages = params.containsKey("pages") ? ((Number) params.get("pages")).intValue() : 1;
                job = importPipelineService.importTrending(pages);
            }
            case "seasonal" -> {
                int pages = params.containsKey("pages") ? ((Number) params.get("pages")).intValue() : 1;
                job = importPipelineService.importSeasonal(pages);
            }
            case "malIds" -> {
                @SuppressWarnings("unchecked")
                List<Integer> malIds = ((List<Number>) params.get("malIds")).stream()
                    .map(Number::intValue).toList();
                job = importPipelineService.importByMalIds(malIds);
            }
            default -> {
                return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Invalid type: " + type + ". Valid: full, trending, seasonal, malIds"));
            }
        }

        return ResponseEntity.ok(ApiResponse.success("Import job started", job));
    }

    @GetMapping("/status")
    @Operation(summary = "Get current import status",
        description = "Returns the currently running import job, if any")
    public ResponseEntity<ApiResponse<ImportJob>> getStatus() {
        Optional<ImportJob> running = importPipelineService.getRunningJob();
        return running.map(job -> ResponseEntity.ok(ApiResponse.success(job)))
            .orElseGet(() -> ResponseEntity.ok(ApiResponse.success(null)));
    }

    @GetMapping("/jobs")
    @Operation(summary = "List recent import jobs",
        description = "Returns all import jobs ordered by creation date")
    public ResponseEntity<ApiResponse<List<ImportJob>>> listJobs() {
        List<ImportJob> jobs = importPipelineService.getRecentJobs();
        return ResponseEntity.ok(ApiResponse.success(jobs));
    }

    @GetMapping("/jobs/{jobId}/logs")
    @Operation(summary = "Get logs for an import job",
        description = "Returns the import log entries for a specific job")
    public ResponseEntity<ApiResponse<List<ImportLog>>> getJobLogs(
            @PathVariable UUID jobId) {
        List<ImportLog> logs = importPipelineService.getJobLogs(jobId);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @PostMapping("/cancel")
    @Operation(summary = "Cancel current import job",
        description = "Cancels the currently running import job")
    public ResponseEntity<ApiResponse<String>> cancelImport() {
        importPipelineService.cancelCurrentJob();
        return ResponseEntity.ok(ApiResponse.success("Import job cancelled"));
    }

    @GetMapping("/stats")
    @Operation(summary = "Get catalog statistics",
        description = "Returns statistics about the anime catalog")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStats() {
        Map<String, Object> stats = importPipelineService.getStatistics();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @PostMapping("/retry-failed")
    @Operation(summary = "Retry failed records from a job",
        description = "Re-imports all failed records from a previous import job")
    public ResponseEntity<ApiResponse<ImportJob>> retryFailed(@RequestBody Map<String, Object> params) {
        String jobIdStr = (String) params.get("jobId");
        if (jobIdStr == null || jobIdStr.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("jobId is required"));
        }
        UUID jobId = UUID.fromString(jobIdStr);
        List<ImportLog> failedLogs = importLogRepository.findByJobIdOrderByCreatedAtDesc(jobId)
            .stream()
            .filter(log -> log.getStatus() == ImportLog.ImportRecordStatus.FAILED)
            .toList();

        if (failedLogs.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success("No failed records to retry", null));
        }

        List<Integer> malIds = failedLogs.stream()
            .map(ImportLog::getMalId)
            .filter(Objects::nonNull)
            .toList();

        ImportJob retryJob = importPipelineService.importByMalIds(malIds);
        return ResponseEntity.ok(ApiResponse.success(
            "Retrying " + malIds.size() + " failed records", retryJob));
    }
}
