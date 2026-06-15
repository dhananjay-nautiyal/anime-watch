# anime-watch

A legal anime info and news website backend built with Spring Boot 3.2 and Java 21.

## Prerequisites

- Java 21
- Maven
- MySQL 8+

## Quick Start

```bash
mvn clean install
mvn spring-boot:run
```

Configure via environment variables or `application.yml`.



## Features

### Anime
- Trending, seasonal, and search endpoints (powered by Jikan API / MyAnimeList)
- Advanced filtering by genre, type, status, score, and more
- Ehcache 3 caching for fast repeated queries
- Rate-limited API calls to comply with Jikan rate limits

### Authentication & Authorization
- JWT-based auth (access + refresh token flow)
- Email verification on registration
- Resend verification email
- Forgot / reset password
- Logout (refresh token revocation)
- Role-based (USER / ADMIN)

### User Profile
- View / update profile name
- Change password
- Delete account

### Watchlist & Favorites
- Track anime with statuses: WATCHING, COMPLETED, PLAN_TO_WATCH
- Manage favorites list

### Reviews
- Add / edit / delete reviews with star rating (1-5)
- One review per user per anime
- Ownership verification on modifications

### Admin
- User management (list, delete)
- Anime management (set affiliate URL, delete)
- Review moderation (delete any review)
- News articles CRUD

### News
- Create, update, delete news articles (admin)
- Public read access with pagination

### Core Framework
- Error code enum with 23 codes + i18n message bundle
- Exception hierarchy: BusinessException, TechnicalException, ValidationException, AuthenticationException
- Centralized GlobalExceptionHandler with consistent JSON error responses
- JPA Specifications fluent builder for dynamic queries
- Custom validation annotations (@Name, @Password, @Phone, @NoEmpty)
- Auditable base entity with auto-timestamps and auditor tracking
- CMAT audit entities for change data capture
- Setting / SettingDetail generic configuration entities

## API Documentation

Once running: [Swagger UI](http://localhost:8080/swagger-ui.html)

## Project Structure

```
com.animeSite/
├── AnimeBackendApplication.java
├── audit/                          # CMAT audit entities
│   ├── CMATSetting.java
│   └── CMATSettingDetail.java
├── constant/                       # Enums and app constants
│   ├── Role.java
│   ├── WatchlistStatus.java
│   ├── SettingType.java
│   └── AppConstants.java
├── config/                         # App-specific configuration
│   ├── AppConfig.java
│   ├── OpenApiConfig.java
│   └── SecurityConfig.java
├── controller/                     # REST controllers
│   ├── AdminController.java
│   ├── AnimeController.java
│   ├── AuthController.java
│   ├── CodeController.java         # Static code/lookup endpoints
│   ├── FavoriteController.java
│   ├── HomeController.java         # App info
│   ├── NewsController.java
│   ├── ReviewController.java
│   ├── UserController.java
│   └── WatchlistController.java
├── core/                           # Shared framework (like ixia-core)
│   ├── audit/Auditable.java        # Base entity with timestamps
│   ├── cache/CacheNames.java
│   ├── config/AuditConfig.java
│   ├── exception/                  # Error codes + exception hierarchy
│   │   ├── AbstractException.java
│   │   ├── AuthenticationException.java
│   │   ├── BusinessException.java
│   │   ├── ErrorCode.java
│   │   ├── FaultCode.java
│   │   ├── FaultInfo.java
│   │   ├── GlobalExceptionHandler.java
│   │   ├── ServiceCodeHelper.java
│   │   ├── TechnicalException.java
│   │   └── ValidationException.java
│   ├── model/                      # Shared response DTOs
│   │   ├── ApiResponse.java
│   │   └── PageResponse.java
│   ├── security/                   # JWT + Spring Security
│   ├── spec/                       # JPA Specifications builder
│   │   ├── PredicateBuilder.java
│   │   ├── Specifications.java
│   │   ├── Sorts.java
│   │   ├── AbstractSpecification.java
│   │   ├── EqualSpecification.java
│   │   ├── NotEqualSpecification.java
│   │   ├── LikeSpecification.java
│   │   ├── NotLikeSpecification.java
│   │   ├── GtSpecification.java
│   │   ├── GeSpecification.java
│   │   ├── LtSpecification.java
│   │   ├── LeSpecification.java
│   │   ├── BetweenSpecification.java
│   │   ├── InSpecification.java
│   │   └── NotInSpecification.java
│   └── validation/                 # Custom validation annotations
│       ├── annotation/
│       │   ├── Name.java
│       │   ├── Password.java
│       │   ├── Phone.java
│       │   └── NoEmpty.java
│       └── validator/
│           ├── NameValidator.java
│           ├── PasswordValidator.java
│           └── PhoneValidator.java
├── helper/                         # Service helpers
├── httpclient/                     # External API clients
│   └── JikanApiClient.java
├── initializer/                    # WebApplicationInitializer
│   └── WebInitializer.java
├── model/                          # Request/Response DTOs
│   ├── LoginRequest.java
│   ├── RegisterRequest.java
│   ├── ReviewRequest.java
│   ├── WatchlistRequest.java
│   ├── UpdateStatusRequest.java
│   ├── NewsRequest.java
│   ├── ChangePasswordRequest.java
│   ├── UpdateProfileRequest.java
│   ├── ForgotPasswordRequest.java
│   ├── ResetPasswordRequest.java
│   ├── JikanAnimeData.java
│   ├── JikanListResponse.java
│   ├── JikanSingleResponse.java
│   └── JikanPagination.java
├── persist/                        # JPA entities
│   ├── Anime.java
│   ├── User.java
│   ├── Favorites.java
│   ├── Watchlist.java
│   ├── Review.java
│   ├── NewsArticle.java
│   ├── RefreshToken.java
│   ├── PasswordResetToken.java
│   ├── EmailVerificationToken.java
│   ├── Setting.java
│   └── SettingDetail.java
├── repo/                           # JPA repositories
│   ├── AnimeRepository.java
│   ├── UserRepository.java
│   ├── WatchlistRepository.java
│   ├── FavoritesRepository.java
│   ├── ReviewRepository.java
│   ├── NewsRepository.java
│   ├── RefreshTokenRepository.java
│   ├── PasswordResetTokenRepository.java
│   ├── EmailVerificationTokenRepository.java
│   ├── SettingRepository.java
│   ├── SettingDetailRepository.java
│   ├── CMATSettingRepository.java
│   └── CMATSettingDetailRepository.java
├── security/                       # JWT authentication
│   ├── CustomUserDetailsService.java
│   ├── JwtAuthenticationFilter.java
│   └── JwtTokenProvider.java
├── service/                        # Service interfaces
│   ├── AnimeService.java
│   ├── AuthService.java
│   ├── EmailService.java
│   ├── FavoriteService.java
│   ├── NewsService.java
│   ├── ReviewService.java
│   ├── UserService.java
│   └── WatchlistService.java
└── service/impl/                   # Service implementations
    ├── AnimeServiceImpl.java
    ├── AuthServiceImpl.java
    ├── EmailServiceImpl.java
    ├── FavoriteServiceImpl.java
    ├── NewsServiceImpl.java
    ├── ReviewServiceImpl.java
    ├── UserServiceImpl.java
    └── WatchlistServiceImpl.java
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Spring Boot 3.2 |
| Language | Java 21 |
| Database | MySQL (JPA / Hibernate, ddl-auto: update) |
| Auth | JWT (jjwt 0.12) + Spring Security |
| API Docs | Springdoc OpenAPI 2.3 |
| Caching | Ehcache 3 (JCache) |
| External API | Jikan API v4 (MyAnimeList) |
| Email | Spring Mail (Gmail SMTP, async) |
| Build | Maven |
| Container | Docker (Eclipse Temurin 21) |
