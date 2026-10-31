-- Baseline schema for the anime-watch backend.
--
-- GENERATED, then reviewed: this is the authoritative schema that Hibernate
-- derives from the JPA entity model (produced via ddl-auto=create against a
-- scratch PostgreSQL 16, then pg_dump --schema-only). It exists so Flyway --
-- not Hibernate's ddl-auto=update -- owns schema changes in production.
--
-- On an existing database (production), Flyway baselines at version 1 via
-- baseline-on-migrate and will not re-run this file; future schema changes
-- must be added as V2+, never by Hibernate.
--
-- Types use char(36) for UUIDs (hibernate.type.preferred_uuid_jdbc_type=char),
-- matching the runtime configuration.

CREATE TABLE public.anime (
    episodes integer,
    favorites integer,
    mal_id integer NOT NULL,
    members integer,
    popularity integer,
    rank integer,
    score double precision,
    year integer,
    created_at timestamp(6) without time zone,
    imported_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    affiliate_url text,
    aired text,
    background text,
    banner_url text,
    created_by character varying(255),
    duration character varying(255),
    image_url text,
    mal_url text,
    rating character varying(255),
    season character varying(255),
    slug character varying(255),
    source character varying(255),
    status character varying(255),
    synopsis text,
    title character varying(255) NOT NULL,
    title_english character varying(255),
    title_japanese character varying(255),
    title_synonyms text,
    trailer_embed_url text,
    trailer_url character varying(255),
    type character varying(255),
    updated_by character varying(255)
);

CREATE TABLE public.anime_character (
    mal_id integer NOT NULL,
    id character(36) NOT NULL,
    image_url text,
    name character varying(255) NOT NULL,
    role character varying(255)
);

CREATE TABLE public.anime_characters (
    anime_id character(36) NOT NULL,
    character_id character(36) NOT NULL
);

CREATE TABLE public.anime_external_id (
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    external_id character varying(255),
    site character varying(255) NOT NULL,
    url text
);

CREATE TABLE public.anime_genres (
    anime_id character(36) NOT NULL,
    genre_id character(36) NOT NULL
);

CREATE TABLE public.anime_licensors (
    anime_id character(36) NOT NULL,
    licensor_id character(36) NOT NULL
);

CREATE TABLE public.anime_producers (
    anime_id character(36) NOT NULL,
    producer_id character(36) NOT NULL
);

CREATE TABLE public.anime_provider_cache (
    episode_count integer,
    failure_count integer,
    mal_id integer NOT NULL,
    streamable boolean NOT NULL,
    validated boolean,
    created_at timestamp(6) with time zone NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    id bigint NOT NULL,
    last_success_time timestamp(6) with time zone,
    preferred_provider character varying(50),
    provider character varying(50) NOT NULL
);

CREATE SEQUENCE public.anime_provider_cache_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.anime_provider_cache_id_seq OWNED BY public.anime_provider_cache.id;

CREATE TABLE public.anime_recommendation (
    mal_id integer NOT NULL,
    votes integer,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    image_url text,
    title character varying(255)
);

CREATE TABLE public.anime_staff (
    mal_id integer NOT NULL,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    staff_id character(36) NOT NULL,
    image_url text,
    name character varying(255) NOT NULL,
    role character varying(255) NOT NULL
);

CREATE TABLE public.anime_studios (
    anime_id character(36) NOT NULL,
    studio_id character(36) NOT NULL
);

CREATE TABLE public.anime_tags (
    anime_id character(36) NOT NULL,
    tag_id character(36) NOT NULL
);

CREATE TABLE public.anime_theme (
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    text text NOT NULL,
    type character varying(255) NOT NULL
);

CREATE TABLE public.cmat_setting (
    is_active integer,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    cmat_id character(36) NOT NULL,
    id character(36),
    created_by character varying(255),
    event_type character varying(255),
    setting_type character varying(255),
    updated_by character varying(255),
    CONSTRAINT cmat_setting_setting_type_check CHECK (((setting_type)::text = ANY ((ARRAY['EMAIL_CONFIG'::character varying, 'TWILIO_CONFIG'::character varying, 'APP_CONFIG'::character varying, 'CACHE_CONFIG'::character varying, 'SECURITY_CONFIG'::character varying])::text[])))
);

CREATE TABLE public.cmat_setting_detail (
    is_active integer,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    cmat_id character(36) NOT NULL,
    id character(36),
    setting_id character(36),
    created_by character varying(255),
    description text,
    event_type character varying(255),
    setting_key character varying(255),
    setting_value text,
    updated_by character varying(255)
);

CREATE TABLE public.email_verification_tokens (
    created_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    created_by character varying(255),
    token character varying(255) NOT NULL,
    updated_by character varying(255)
);

CREATE TABLE public.episodes (
    anime_mal_id integer NOT NULL,
    episode_number integer NOT NULL,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    created_by character varying(255),
    embed_url text,
    title character varying(255),
    updated_by character varying(255),
    video_url text
);

CREATE TABLE public.favorites (
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    created_by character varying(255),
    updated_by character varying(255)
);

CREATE TABLE public.genre (
    mal_id integer NOT NULL,
    id character(36) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255)
);

CREATE TABLE public.import_job (
    fail_count integer,
    processed_items integer,
    skip_count integer,
    success_count integer,
    total_items integer,
    completed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone,
    started_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    error_message text,
    parameters text,
    status character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    CONSTRAINT import_job_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE public.import_log (
    mal_id integer,
    created_at timestamp(6) without time zone,
    duration_ms bigint,
    id character(36) NOT NULL,
    job_id character(36) NOT NULL,
    error_message text,
    status character varying(255) NOT NULL,
    title character varying(255),
    CONSTRAINT import_log_status_check CHECK (((status)::text = ANY ((ARRAY['SUCCESS'::character varying, 'SKIPPED'::character varying, 'FAILED'::character varying])::text[])))
);

CREATE TABLE public.licensor (
    mal_id integer NOT NULL,
    id character(36) NOT NULL,
    name character varying(255) NOT NULL
);

CREATE TABLE public.news_articles (
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    author character varying(255) NOT NULL,
    content text NOT NULL,
    created_by character varying(255),
    image_url character varying(255),
    title character varying(255) NOT NULL,
    updated_by character varying(255)
);

CREATE TABLE public.password_reset_tokens (
    created_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    created_by character varying(255),
    token character varying(255) NOT NULL,
    updated_by character varying(255)
);

CREATE TABLE public.producer (
    mal_id integer NOT NULL,
    id character(36) NOT NULL,
    name character varying(255) NOT NULL
);

CREATE TABLE public.push_tokens (
    active boolean NOT NULL,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    platform character varying(20) NOT NULL,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    expo_push_token character varying(512) NOT NULL,
    created_by character varying(255),
    updated_by character varying(255)
);

CREATE TABLE public.refresh_tokens (
    revoked boolean NOT NULL,
    created_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    created_by character varying(255),
    token character varying(255) NOT NULL,
    updated_by character varying(255)
);

CREATE TABLE public.related_anime (
    related_mal_id integer NOT NULL,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    related_image_url text,
    related_title character varying(255),
    relation_type character varying(255) NOT NULL
);

CREATE TABLE public.reviews (
    star_rating integer NOT NULL,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    comment text,
    created_by character varying(255),
    updated_by character varying(255)
);

CREATE TABLE public.setting (
    is_active integer,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    created_by character varying(255),
    setting_type character varying(255),
    updated_by character varying(255),
    CONSTRAINT setting_setting_type_check CHECK (((setting_type)::text = ANY ((ARRAY['EMAIL_CONFIG'::character varying, 'TWILIO_CONFIG'::character varying, 'APP_CONFIG'::character varying, 'CACHE_CONFIG'::character varying, 'SECURITY_CONFIG'::character varying])::text[])))
);

CREATE TABLE public.setting_detail (
    is_active integer,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    setting_id character(36),
    created_by character varying(255),
    description text,
    setting_key character varying(255),
    setting_value text,
    updated_by character varying(255)
);

CREATE TABLE public.studio (
    mal_id integer NOT NULL,
    id character(36) NOT NULL,
    name character varying(255) NOT NULL
);

CREATE TABLE public.tag (
    weight integer,
    id character(36) NOT NULL,
    name character varying(255) NOT NULL
);

CREATE TABLE public.users (
    is_verified boolean NOT NULL,
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    id character(36) NOT NULL,
    created_by character varying(255),
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    updated_by character varying(255),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['ROLE_USER'::character varying, 'ROLE_ADMIN'::character varying])::text[])))
);

CREATE TABLE public.watch_history (
    duration_seconds double precision,
    episode_number integer NOT NULL,
    mal_id integer NOT NULL,
    progress_seconds double precision,
    updated_at timestamp(6) with time zone NOT NULL,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    anime_image character varying(255),
    anime_title character varying(255)
);

CREATE TABLE public.watchlist (
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    anime_id character(36) NOT NULL,
    id character(36) NOT NULL,
    user_id character(36) NOT NULL,
    created_by character varying(255),
    status character varying(255) NOT NULL,
    updated_by character varying(255),
    CONSTRAINT watchlist_status_check CHECK (((status)::text = ANY ((ARRAY['WATCHING'::character varying, 'COMPLETED'::character varying, 'PLAN_TO_WATCH'::character varying])::text[])))
);

ALTER TABLE ONLY public.anime_provider_cache ALTER COLUMN id SET DEFAULT nextval('public.anime_provider_cache_id_seq'::regclass);

ALTER TABLE ONLY public.anime_character
    ADD CONSTRAINT anime_character_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime_external_id
    ADD CONSTRAINT anime_external_id_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime
    ADD CONSTRAINT anime_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.anime
    ADD CONSTRAINT anime_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime_provider_cache
    ADD CONSTRAINT anime_provider_cache_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.anime_provider_cache
    ADD CONSTRAINT anime_provider_cache_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime_recommendation
    ADD CONSTRAINT anime_recommendation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime
    ADD CONSTRAINT anime_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.anime_staff
    ADD CONSTRAINT anime_staff_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anime_theme
    ADD CONSTRAINT anime_theme_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cmat_setting_detail
    ADD CONSTRAINT cmat_setting_detail_pkey PRIMARY KEY (cmat_id);

ALTER TABLE ONLY public.cmat_setting
    ADD CONSTRAINT cmat_setting_pkey PRIMARY KEY (cmat_id);

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.genre
    ADD CONSTRAINT genre_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.genre
    ADD CONSTRAINT genre_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_job
    ADD CONSTRAINT import_job_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_log
    ADD CONSTRAINT import_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.licensor
    ADD CONSTRAINT licensor_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.licensor
    ADD CONSTRAINT licensor_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.producer
    ADD CONSTRAINT producer_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.producer
    ADD CONSTRAINT producer_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.related_anime
    ADD CONSTRAINT related_anime_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_anime_id_user_id_key UNIQUE (anime_id, user_id);

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.setting_detail
    ADD CONSTRAINT setting_detail_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT setting_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.studio
    ADD CONSTRAINT studio_mal_id_key UNIQUE (mal_id);

ALTER TABLE ONLY public.studio
    ADD CONSTRAINT studio_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_name_key UNIQUE (name);

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.watch_history
    ADD CONSTRAINT watch_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.watch_history
    ADD CONSTRAINT watch_history_user_id_mal_id_key UNIQUE (user_id, mal_id);

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_pkey PRIMARY KEY (id);

CREATE INDEX idx_anime_created_at ON public.anime USING btree (created_at);

CREATE INDEX idx_anime_imported_at ON public.anime USING btree (imported_at);

CREATE INDEX idx_anime_popularity ON public.anime USING btree (popularity);

CREATE INDEX idx_anime_rank ON public.anime USING btree (rank);

CREATE INDEX idx_anime_rating ON public.anime USING btree (rating);

CREATE INDEX idx_anime_score ON public.anime USING btree (score);

CREATE INDEX idx_anime_season_year ON public.anime USING btree (season, year);

CREATE INDEX idx_anime_status ON public.anime USING btree (status);

CREATE INDEX idx_anime_title ON public.anime USING btree (title);

CREATE INDEX idx_anime_type ON public.anime USING btree (type);

CREATE INDEX idx_episodes_anime_mal_id ON public.episodes USING btree (anime_mal_id);

CREATE INDEX idx_episodes_mal_id_number ON public.episodes USING btree (anime_mal_id, episode_number);

CREATE INDEX idx_favorites_anime_id ON public.favorites USING btree (anime_id);

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);

CREATE INDEX idx_import_job_status_created ON public.import_job USING btree (status, created_at);

CREATE INDEX idx_import_log_job_id ON public.import_log USING btree (job_id);

CREATE INDEX idx_reviews_anime_id ON public.reviews USING btree (anime_id);

CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (user_id);

CREATE INDEX idx_setting_detail_key ON public.setting_detail USING btree (setting_key);

CREATE INDEX idx_setting_detail_setting_id ON public.setting_detail USING btree (setting_id);

CREATE INDEX idx_watch_history_updated ON public.watch_history USING btree (user_id, updated_at);

CREATE INDEX idx_watch_history_user_id ON public.watch_history USING btree (user_id);

CREATE INDEX idx_watchlist_anime_id ON public.watchlist USING btree (anime_id);

CREATE INDEX idx_watchlist_user_id ON public.watchlist USING btree (user_id);

ALTER TABLE ONLY public.anime_theme
    ADD CONSTRAINT fk1h03qklf62b3wxb6xl0su37c4 FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk1lih5y2npsf8u5o3vhdb9y0os FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.anime_producers
    ADD CONSTRAINT fk1ywpo9gwfn4lrifdveuxi7jtg FOREIGN KEY (producer_id) REFERENCES public.producer(id);

ALTER TABLE ONLY public.related_anime
    ADD CONSTRAINT fk2iq81bgf8rvmwpshpevvr1daw FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_staff
    ADD CONSTRAINT fk3or6kny6f8bed8ui27njhth7d FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_staff
    ADD CONSTRAINT fk4hsvctguppmye32i40jrnv7bw FOREIGN KEY (staff_id) REFERENCES public.anime_staff(id);

ALTER TABLE ONLY public.anime_external_id
    ADD CONSTRAINT fk58q2jht30yymgu3xogbtuwp7j FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT fk7kq6aee8qr51bm8p6po2xf64 FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_tags
    ADD CONSTRAINT fk8sbjpv9gv863tsh2cjglyv5sp FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fkcgy7qjc1r99dp117y9en6lxye FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.anime_genres
    ADD CONSTRAINT fkd3ik31bdkut6ch5jyboqnxx5o FOREIGN KEY (genre_id) REFERENCES public.genre(id);

ALTER TABLE ONLY public.anime_recommendation
    ADD CONSTRAINT fkddgs1rl1w8m86494sumrs2viw FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT fkden7i83qo2swnr5br4wgc5r7j FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fkhmpni6qm7hfymu98ha29y3xtj FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT fki1c4mmamlb8keqt74k4lrtwhc FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT fkiomcnsudx4k3tblj1nbeks0l0 FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.setting_detail
    ADD CONSTRAINT fkj8ydssky0yvhiebyjxcdes3qx FOREIGN KEY (setting_id) REFERENCES public.setting(id);

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fkk3ndxg5xp6v7wd4gjyusp15gq FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT fkk7du8b8ewipawnnpg76d55fus FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.anime_licensors
    ADD CONSTRAINT fkkbskb6uh0bnmqo6b9opqhcpkr FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_tags
    ADD CONSTRAINT fkluubgwb7adam26b4c7k5ysahk FOREIGN KEY (tag_id) REFERENCES public.tag(id);

ALTER TABLE ONLY public.anime_producers
    ADD CONSTRAINT fkmact00ih3367wa9jwxq2lfs3x FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_genres
    ADD CONSTRAINT fkorrk6ybv1u14qh4bd1tndm125 FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_studios
    ADD CONSTRAINT fkqb9vo4fy4r3y9csl1j3lqc9gy FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.import_log
    ADD CONSTRAINT fkqu16e36tqsnppq5c6wxmnuslx FOREIGN KEY (job_id) REFERENCES public.import_job(id);

ALTER TABLE ONLY public.anime_studios
    ADD CONSTRAINT fkr26pl8ebo5i08q2l8d983fu0o FOREIGN KEY (studio_id) REFERENCES public.studio(id);

ALTER TABLE ONLY public.anime_characters
    ADD CONSTRAINT fkr474ydylsyjanv3ts9n2ymex9 FOREIGN KEY (anime_id) REFERENCES public.anime(id);

ALTER TABLE ONLY public.anime_characters
    ADD CONSTRAINT fkrnpfqktgylntsodetwgl8c9d0 FOREIGN KEY (character_id) REFERENCES public.anime_character(id);

ALTER TABLE ONLY public.anime_licensors
    ADD CONSTRAINT fktoyr29yhqnej7i6lm8p6rq0p FOREIGN KEY (licensor_id) REFERENCES public.licensor(id);

