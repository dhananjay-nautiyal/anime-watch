package com.animeSite.httpclient;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Anikoto catalog API has no search endpoint, so series discovery goes
 * through the public site's search page. These tests pin the card parsing that
 * replaced the old (and always-empty) catalog scan.
 */
class AnikotoServiceTest {

    @Test
    @DisplayName("Parses series id and title from search result cards")
    void parseSearchCards_extractsIdAndTitle() {
        String html = """
            <div id="list-items" class="ani items">
              <div class="item ">
                <div class="inner">
                  <div class="ani poster tip" data-tip="1610">
                    <a href="https://anikototv.to/watch/death-note-fc8mq/ep-1">
                      <img src="https://cdn.example/x.jpg" alt="Death Note" />
                    </a>
                  </div>
                </div>
              </div>
              <div class="item ">
                <div class="inner">
                  <div class="ani poster tip" data-tip="522">
                    <a href="https://anikototv.to/watch/death-note-relight-zxhwn/ep-1">
                      <img src="https://cdn.example/y.jpg" alt="Death Note: Relight" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            """;

        List<Map.Entry<String, String>> cards = AnikotoService.parseSearchCards(html);

        assertThat(cards).hasSize(2);
        assertThat(cards.get(0).getKey()).isEqualTo("1610");
        assertThat(cards.get(0).getValue()).isEqualTo("Death Note");
        assertThat(cards.get(1).getKey()).isEqualTo("522");
        assertThat(cards.get(1).getValue()).isEqualTo("Death Note: Relight");
    }

    @Test
    @DisplayName("Ignores cards without both an id and a title")
    void parseSearchCards_skipsIncompleteCards() {
        String html = """
            <div class="item ">
              <div class="ani poster tip" data-tip="9999"></div>
            </div>
            <div class="item ">
              <div class="ani poster tip"><img alt="No id" /></div>
            </div>
            """;

        assertThat(AnikotoService.parseSearchCards(html)).isEmpty();
    }

    @Test
    @DisplayName("Handles null and blank search pages")
    void parseSearchCards_handlesEmptyInput() {
        assertThat(AnikotoService.parseSearchCards(null)).isEmpty();
        assertThat(AnikotoService.parseSearchCards("")).isEmpty();
        assertThat(AnikotoService.parseSearchCards("   ")).isEmpty();
    }
}
