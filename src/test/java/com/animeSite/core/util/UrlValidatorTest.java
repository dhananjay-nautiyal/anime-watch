package com.animeSite.core.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UrlValidatorTest {

    // verifyDns=false keeps these unit tests offline/deterministic; the DNS
    // rebinding guard is exercised separately below with a resolvable host.
    private static UrlValidator validator() {
        return new UrlValidator("", "", "", false);
    }

    @Test
    void allowsNamedStreamProvider() {
        assertTrue(validator().isValidStreamUrl("https://anineko.to/watch/naruto-episode-1"));
    }

    @Test
    void allowsStreamCdnSuffixFamily() {
        assertTrue(validator().isValidStreamUrl("https://7v8gl.eclipseharbor.space/hls/seg.ts"));
        assertTrue(validator().isValidStreamUrl("https://7o819.twilightharbor.space/hls/seg.ts"));
    }

    @Test
    void blocksArbitraryPublicHost() {
        // The old validator accepted any publicly resolvable host. That is the
        // SSRF primitive this change removes.
        assertFalse(validator().isValidStreamUrl("https://example.com/hls/seg.ts"));
        assertFalse(validator().isValidStreamUrl("https://attacker.example.net/segment.ts"));
    }

    @Test
    void blocksPrivateAndLoopbackTargets() {
        assertFalse(validator().isValidStreamUrl("http://127.0.0.1:8080/seg.ts"));
        assertFalse(validator().isValidStreamUrl("http://10.0.0.5/seg.ts"));
        assertFalse(validator().isValidStreamUrl("http://192.168.1.1/seg.ts"));
        assertFalse(validator().isValidStreamUrl("http://169.254.169.254/latest/meta-data"));
    }

    @Test
    void blocksNonHttpSchemes() {
        assertFalse(validator().isValidStreamUrl("file:///etc/passwd"));
        assertFalse(validator().isValidStreamUrl("ftp://anineko.to/seg.ts"));
        assertFalse(validator().isValidStreamUrl(null));
        assertFalse(validator().isValidStreamUrl(""));
    }

    @Test
    void imagesRestrictedToMalCdn() {
        UrlValidator v = validator();
        assertTrue(v.isValidImageUrl("https://cdn.myanimelist.net/images/anime/1234/5678.jpg"));
        assertFalse(v.isValidImageUrl("https://example.com/image.jpg"));
        assertFalse(v.isValidImageUrl("http://127.0.0.1/image.jpg"));
    }

    @Test
    void respectsCustomAllowListOverride() {
        UrlValidator v = new UrlValidator("cdn.example.org", "mycdn.example", "", false);
        assertTrue(v.isValidStreamUrl("https://cdn.example.org/seg.ts"));
        assertTrue(v.isValidStreamUrl("https://7x.mycdn.example/seg.ts"));
        // The built-in defaults are replaced, not merged.
        assertFalse(v.isValidStreamUrl("https://anineko.to/watch/x"));
    }

    @Test
    void rejectsHostThatResolvesToLoopback() {
        // "localhost" is allow-listed via a custom suffix but resolves to
        // loopback, so the DNS guard must reject it.
        UrlValidator v = new UrlValidator("", "localhost", "", true);
        assertFalse(v.isValidStreamUrl("http://localhost/seg.ts"));
    }
}
