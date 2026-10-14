FROM maven:3.9.6-eclipse-temurin-21-alpine AS build

WORKDIR /app

# Dependencies first (cached unless pom.xml changes), then sources (any src
# change invalidates ONLY the package layer, so Render can never again serve
# a stale jar from cache while reporting a fresh commit).
COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src

RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/anime-backend-*.jar app.jar

EXPOSE 8080

# NOTE: exec-form ENTRYPOINT does NOT expand ${...}, so don't put placeholders
# here (it previously produced a literal "-prod" profile and prod config never
# loaded). Spring Boot reads SPRING_PROFILES_ACTIVE env natively — set it to
# "prod" in the Render dashboard.
ENTRYPOINT ["java", "-jar", "app.jar"]
