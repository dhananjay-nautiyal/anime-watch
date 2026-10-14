package com.animeSite.model;

import lombok.Data;
import java.util.List;

@Data
public class JikanEpisodeListResponse {

    private List<JikanEpisodeData> data;
    private JikanPagination pagination;
}
