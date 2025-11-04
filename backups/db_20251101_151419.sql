


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" bigint,
    "action" "text" NOT NULL,
    "diff" "jsonb",
    "context" "jsonb",
    "dt_utc" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."imports" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text",
    "file_name" "text",
    "row_count" integer DEFAULT 0,
    "merged_count" integer DEFAULT 0,
    "inserted_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'RUNNING'::"text",
    "error_message" "text",
    CONSTRAINT "imports_status_check" CHECK (("status" = ANY (ARRAY['RUNNING'::"text", 'FAILED'::"text", 'COMPLETED'::"text"])))
);


ALTER TABLE "public"."imports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."imports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."imports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."imports_id_seq" OWNED BY "public"."imports"."id";



CREATE TABLE IF NOT EXISTS "public"."trade_images" (
    "id" bigint NOT NULL,
    "trade_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "path" "text" NOT NULL,
    "sort_index" integer DEFAULT 0,
    "byte_size" integer,
    "content_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trade_images" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trade_images_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trade_images_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trade_images_id_seq" OWNED BY "public"."trade_images"."id";



CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticket" "text" NOT NULL,
    "broker" "text",
    "broker_account" "text",
    "symbol" "text" NOT NULL,
    "side" "text",
    "volume" numeric,
    "ccy" "text" DEFAULT 'USD'::"text",
    "entry_price" numeric,
    "exit_price" numeric,
    "dt_open_utc" timestamp with time zone NOT NULL,
    "dt_close_utc" timestamp with time zone,
    "timeframe" "text",
    "session" "text",
    "ea" "text",
    "fee_usd" numeric,
    "swap_usd" numeric,
    "tax_usd" numeric,
    "pnl_usd_gross" numeric,
    "pnl_usd_net" numeric,
    "rr" numeric,
    "status" "text" DEFAULT 'CLOSED'::"text",
    "close_reason" "text",
    "notes" "text",
    "tags" "text"[],
    "images_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trades_close_reason_check" CHECK (("close_reason" = ANY (ARRAY['TP'::"text", 'SL'::"text", 'manual'::"text", 'partial'::"text", 'timeout'::"text"]))),
    CONSTRAINT "trades_side_check" CHECK (("side" = ANY (ARRAY['BUY'::"text", 'SELL'::"text"]))),
    CONSTRAINT "trades_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'CLOSED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trades_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trades_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trades_id_seq" OWNED BY "public"."trades"."id";



CREATE TABLE IF NOT EXISTS "public"."trades_raw" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticket" "text" NOT NULL,
    "broker" "text",
    "broker_account" "text",
    "symbol" "text",
    "type" "text",
    "lots" numeric,
    "opening_time_utc" timestamp with time zone,
    "closing_time_utc" timestamp with time zone,
    "entry_price" numeric,
    "exit_price" numeric,
    "commission_usd" numeric,
    "swap_usd" numeric,
    "profit_usd" numeric,
    "raw_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trades_raw" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trades_raw_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trades_raw_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trades_raw_id_seq" OWNED BY "public"."trades_raw"."id";



CREATE OR REPLACE VIEW "public"."v_kpi_min" AS
 SELECT "user_id",
    "count"(*) AS "trades_count",
    "avg"(
        CASE
            WHEN ("pnl_usd_net" IS NOT NULL) THEN
            CASE
                WHEN ("pnl_usd_net" >= (0)::numeric) THEN 1
                ELSE 0
            END
            ELSE NULL::integer
        END) AS "win_rate_raw",
    "sum"(COALESCE("pnl_usd_net", (0)::numeric)) AS "pnl_net_usd",
    "sum"(COALESCE("fee_usd", (0)::numeric)) AS "fees_usd",
    ("avg"(
        CASE
            WHEN ("dt_close_utc" IS NOT NULL) THEN EXTRACT(epoch FROM ("dt_close_utc" - "dt_open_utc"))
            ELSE NULL::numeric
        END))::integer AS "avg_duration_sec"
   FROM "public"."trades"
  GROUP BY "user_id";


ALTER VIEW "public"."v_kpi_min" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trades_with_duration" AS
 SELECT "id",
    "user_id",
    "ticket",
    "broker",
    "broker_account",
    "symbol",
    "side",
    "volume",
    "ccy",
    "entry_price",
    "exit_price",
    "dt_open_utc",
    "dt_close_utc",
    "timeframe",
    "session",
    "ea",
    "fee_usd",
    "swap_usd",
    "tax_usd",
    "pnl_usd_gross",
    "pnl_usd_net",
    "rr",
    "status",
    "close_reason",
    "notes",
    "tags",
    "images_count",
    "created_at",
    "updated_at",
        CASE
            WHEN ("dt_close_utc" IS NOT NULL) THEN (EXTRACT(epoch FROM ("dt_close_utc" - "dt_open_utc")))::integer
            ELSE NULL::integer
        END AS "duration_sec"
   FROM "public"."trades" "t";


ALTER VIEW "public"."v_trades_with_duration" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."imports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."imports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trade_images" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trade_images_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trades" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trades_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trades_raw" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trades_raw_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imports"
    ADD CONSTRAINT "imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trade_images"
    ADD CONSTRAINT "trade_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades_raw"
    ADD CONSTRAINT "trades_raw_pkey" PRIMARY KEY ("id");



CREATE INDEX "trade_images_trade_idx" ON "public"."trade_images" USING "btree" ("trade_id");



CREATE UNIQUE INDEX "trades_raw_user_ticket_idx" ON "public"."trades_raw" USING "btree" ("user_id", "ticket");



CREATE UNIQUE INDEX "trades_user_ticket_idx" ON "public"."trades" USING "btree" ("user_id", "ticket");



CREATE OR REPLACE TRIGGER "trg_trades_updated_at" BEFORE UPDATE ON "public"."trades" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."trade_images"
    ADD CONSTRAINT "trade_images_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_own" ON "public"."audit_log" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imports_own" ON "public"."imports" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."trade_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trade_images_own" ON "public"."trade_images" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trades_own" ON "public"."trades" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."trades_raw" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trades_raw_own" ON "public"."trades_raw" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."imports" TO "anon";
GRANT ALL ON TABLE "public"."imports" TO "authenticated";
GRANT ALL ON TABLE "public"."imports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."imports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."imports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."imports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trade_images" TO "anon";
GRANT ALL ON TABLE "public"."trade_images" TO "authenticated";
GRANT ALL ON TABLE "public"."trade_images" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trade_images_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trade_images_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trade_images_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trades_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trades_raw" TO "anon";
GRANT ALL ON TABLE "public"."trades_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."trades_raw" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trades_raw_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trades_raw_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trades_raw_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_kpi_min" TO "anon";
GRANT ALL ON TABLE "public"."v_kpi_min" TO "authenticated";
GRANT ALL ON TABLE "public"."v_kpi_min" TO "service_role";



GRANT ALL ON TABLE "public"."v_trades_with_duration" TO "anon";
GRANT ALL ON TABLE "public"."v_trades_with_duration" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trades_with_duration" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































