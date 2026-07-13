FROM maven:3.9.6-eclipse-temurin-21-alpine AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/anime-backend-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}", "-jar", "app.jar"]
