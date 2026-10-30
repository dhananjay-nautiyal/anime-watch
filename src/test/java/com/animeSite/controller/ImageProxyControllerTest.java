package com.animeSite.controller;

import com.animeSite.core.util.UrlValidator;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.io.OutputStream;
import java.net.InetSocketAddress;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Exercises the redirect revalidation and size-cap behaviour of the image
 * proxy against a local HTTP server. The validator is constructed to allow the
 * "localhost" host (with DNS verification off) so we can drive real redirects,
 * while private-IP targets are still rejected by the built-in private-range
 * guard.
 */
class ImageProxyControllerTest {

    private static HttpServer server;
    private static int port;

    @BeforeAll
    static void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        port = server.getAddress().getPort();

        // A one-hop redirect to a sibling path on the same allow-listed host.
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().add("Location", "/image");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        // Serves a small "image".
        server.createContext("/image", exchange -> {
            byte[] body = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
            exchange.getResponseHeaders().add("Content-Type", "image/jpeg");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        // An endless redirect loop to exercise the hop limit.
        server.createContext("/loop", exchange -> {
            exchange.getResponseHeaders().add("Location", "/loop");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        // A redirect to a private/loopback IP literal that must be blocked.
        server.createContext("/to-private", exchange -> {
            exchange.getResponseHeaders().add("Location", "http://127.0.0.1:9/x.jpg");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        // Streams a body larger than the cap below.
        server.createContext("/huge", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "image/jpeg");
            exchange.sendResponseHeaders(200, 0); // chunked
            try (OutputStream os = exchange.getResponseBody()) {
                byte[] chunk = new byte[1024];
                for (int i = 0; i < 64; i++) { // 64 KB > 1 KB cap
                    os.write(chunk);
                }
            }
        });
        server.start();
    }

    @AfterAll
    static void stopServer() {
        if (server != null) server.stop(0);
    }

    private static ImageProxyController controller(long maxBytes) {
        // Allow "localhost" but keep the private-IP string guard intact.
        UrlValidator validator = new UrlValidator("", "localhost", "localhost", false);
        return new ImageProxyController(validator, maxBytes, 2000);
    }

    private static String url(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    void followsOneValidatedRedirect() {
        ResponseEntity<byte[]> res = controller(1024 * 1024).proxyImage(url("/redirect"));
        assertEquals(200, res.getStatusCode().value());
        assertEquals(3, res.getBody().length);
    }

    @Test
    void servesImageDirectly() {
        ResponseEntity<byte[]> res = controller(1024 * 1024).proxyImage(url("/image"));
        assertEquals(200, res.getStatusCode().value());
    }

    @Test
    void blocksRedirectToPrivateIp() {
        // The redirect target 127.0.0.1:9 is not on the allow-list and matches
        // the private-range guard, so the hop must be refused.
        ResponseEntity<byte[]> res = controller(1024 * 1024).proxyImage(url("/to-private"));
        assertEquals(400, res.getStatusCode().value());
    }

    @Test
    void capsOversizedBodies() {
        // Cap of 1 KB, body is 64 KB -> 413.
        ResponseEntity<byte[]> res = controller(1024).proxyImage(url("/huge"));
        assertEquals(413, res.getStatusCode().value());
    }

    @Test
    void rejectsDisallowedInitialHost() {
        UrlValidator strict = new UrlValidator("", "", "myanimelist.net", false);
        ImageProxyController c = new ImageProxyController(strict, 1024 * 1024, 2000);
        // "localhost" is not on the (default) image allow-list.
        ResponseEntity<byte[]> res = c.proxyImage(url("/image"));
        assertEquals(400, res.getStatusCode().value());
    }
}
