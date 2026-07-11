package com.animeSite;

import com.animeSite.persist.Anime;
import com.animeSite.persist.User;
import com.animeSite.constant.Role;
import com.animeSite.repo.AnimeRepository;
import com.animeSite.repo.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableScheduling
public class AnimeBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnimeBackendApplication.class, args);
    }

    @Bean
    public CommandLineRunner printUrls(ServletWebServerApplicationContext ctx) {
        return args -> {
            int port = ctx.getWebServer().getPort();
            System.out.println("===========================================");
            System.out.println("Anime Backend API is running!");
            System.out.println("Swagger UI: http://localhost:" + port + "/swagger-ui.html");
            System.out.println("OpenAPI Docs: http://localhost:" + port + "/api-docs");
            System.out.println("===========================================");
        };
    }

    @Bean
    public CommandLineRunner initAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (!userRepository.existsByEmail("admin@animesite.com")) {
                User admin = new User();
                admin.setName("Admin");
                admin.setEmail("admin@animesite.com");
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRole(Role.ROLE_ADMIN);
                admin.setVerified(true);
                userRepository.save(admin);
                System.out.println("Default admin created: admin@animesite.com / admin123");
            }
        };
    }

    @Bean
    public CommandLineRunner seedAnime(AnimeRepository animeRepository) {
        return args -> {
            if (animeRepository.count() > 0) return;

            List<Anime> seedList = List.of(
                createAnime(1, "Cowboy Bebop", "Spike and Jet chase criminals across the galaxy aboard the Bebop.", 8.75, 26,
                    "https://cdn.myanimelist.net/images/anime/4/19644.jpg"),
                createAnime(5, "Cowboy Bebop: Tengoku no Tobira", "A terrorist bombing leads Spike and the Bebop crew to investigate a deadly virus.", 8.35, 1,
                    "https://cdn.myanimelist.net/images/anime/5/14334.jpg"),
                createAnime(6, "Trigun", "Vash the Stampede, a gunslinger with a $60 billion bounty, tries to avoid violence.", 8.22, 26,
                    "https://cdn.myanimelist.net/images/anime/7/20310.jpg"),
                createAnime(7, "Witch Hunter Robin", "Robin Sena joins STN-J to hunt witches, but uncovers dark secrets.", 7.33, 26,
                    "https://cdn.myanimelist.net/images/anime/6/75477.jpg"),
                createAnime(15, "Eyeshield 21", "A timid boy becomes a star running back in American football.", 8.16, 145,
                    "https://cdn.myanimelist.net/images/anime/3/76170.jpg"),
                createAnime(16, "Hack//Sign", "Trapped in an MMORPG, a young boy searches for a way out.", 7.20, 26,
                    "https://cdn.myanimelist.net/images/anime/11/80197.jpg"),
                createAnime(17, "Hack//Dusk", "The story of the .hack//SIGN characters in the real world.", 7.46, 12,
                    "https://cdn.myanimelist.net/images/anime/11/80198.jpg"),
                createAnime(19, "Monster", "Dr. Tenma faces the horrific consequences of saving a child's life.", 8.87, 74,
                    "https://cdn.myanimelist.net/images/anime/10/18793.jpg"),
                createAnime(20, "Naruto", "A young ninja seeks acknowledgment and dreams of becoming Hokage.", 7.99, 220,
                    "https://cdn.myanimelist.net/images/anime/13/17405.jpg"),
                createAnime(21, "One Piece", "Monkey D. Luffy sails the Grand Line in search of the One Piece treasure.", 8.73, null,
                    "https://cdn.myanimelist.net/images/anime/1244/138851.jpg"),
                createAnime(24, "Shin Seiki Evangelion", "Teenagers pilot giant mechas to protect Earth from mysterious Angels.", 8.34, 26,
                    "https://cdn.myanimelist.net/images/anime/1314/108941.jpg"),
                createAnime(25, "Evangelion: 1.0 You Are (Not) Alone", "Rebuild of Evangelion part 1.", 7.97, 1,
                    "https://cdn.myanimelist.net/images/anime/8/40385.jpg"),
                createAnime(26, "Evangelion: 2.0 You Can (Not) Advance", "Rebuild of Evangelion part 2.", 8.19, 1,
                    "https://cdn.myanimelist.net/images/anime/6/12322.jpg"),
                createAnime(30, "Evangelion: 3.0 You Can (Not) Redo", "Rebuild of Evangelion part 3.", 7.42, 1,
                    "https://cdn.myanimelist.net/images/anime/9/12643.jpg"),
                createAnime(32, "Neon Genesis Evangelion: The End of Evangelion", "The epic conclusion to the Evangelion series.", 8.58, 1,
                    "https://cdn.myanimelist.net/images/anime/1404/110007.jpg"),
                createAnime(52, "Mobile Suit Gundam: Dai 08 MS Shotai", "A ground-based Gundam squad fights in the jungles of Earth.", 8.20, 12,
                    "https://cdn.myanimelist.net/images/anime/8/11642.jpg"),
                createAnime(73, "Full Metal Panic!", "Sousuke Sagara, a military specialist, must protect female high school student Kaname Chidori.", 7.70, 24,
                    "https://cdn.myanimelist.net/images/anime/3/84353.jpg"),
                createAnime(74, "Full Metal Panic? Fumoffu", "A comedic spin-off of Full Metal Panic!", 8.07, 12,
                    "https://cdn.myanimelist.net/images/anime/4/75203.jpg"),
                createAnime(80, "Mobile Suit Gundam: Dai 08 MS Shotai - Miller's Report", "A side story complementing the 08th MS Team series.", 7.56, 1,
                    "https://cdn.myanimelist.net/images/anime/6/11644.jpg"),
                createAnime(100, "Shinigami no Ballad", "A gentle girl who acts as a psychopomp helps souls pass on.", 7.05, 6,
                    "https://cdn.myanimelist.net/images/anime/9/75188.jpg")
            );
            animeRepository.saveAll(seedList);
            System.out.println("Seeded " + seedList.size() + " anime into the database.");
        };
    }

    private Anime createAnime(int malId, String title, String synopsis, double rating, Integer episodes, String imageUrl) {
        Anime anime = new Anime();
        anime.setMalId(malId);
        anime.setTitle(title);
        anime.setSynopsis(synopsis);
        anime.setRating(rating);
        anime.setEpisodes(episodes);
        anime.setImageUrl(imageUrl);
        return anime;
    }
}
