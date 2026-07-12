package com.animeSite.importpipeline;

import com.animeSite.persist.*;

import java.util.List;

public interface MetadataProvider {

    FullAnimeMetadata fetchFullMetadata(int malId);

    record FullAnimeMetadata(
        Anime anime,
        List<AnimeGenre> genres,
        List<AnimeStudio> studios,
        List<AnimeProducer> producers,
        List<AnimeLicensor> licensors,
        List<AnimeTag> tags,
        List<AnimeCharacter> characters,
        List<AnimeStaff> staff,
        List<RelatedAnime> relatedAnime,
        List<AnimeRecommendation> recommendations,
        List<AnimeExternalId> externalIds,
        List<AnimeTheme> themes
    ) {}
}
