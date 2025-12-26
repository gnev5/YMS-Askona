--
-- PostgreSQL database dump
--

\restrict EKfSufLdp2WgQpxIcW2mU5JpohePFCFOZtDilm3diEHkOpwOYqXjXAV0W2gUWuu

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg13+1)
-- Dumped by pg_dump version 16.10 (Debian 16.10-1.pgdg13+1)

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

--
-- Name: dockstatus; Type: TYPE; Schema: public; Owner: yms
--

CREATE TYPE public.dockstatus AS ENUM (
    'active',
    'inactive',
    'maintenance'
);


ALTER TYPE public.dockstatus OWNER TO yms;

--
-- Name: docktype; Type: TYPE; Schema: public; Owner: yms
--

CREATE TYPE public.docktype AS ENUM (
    'universal',
    'entrance',
    'exit'
);


ALTER TYPE public.docktype OWNER TO yms;

--
-- Name: objecttype; Type: TYPE; Schema: public; Owner: yms
--

CREATE TYPE public.objecttype AS ENUM (
    'warehouse',
    'production',
    'retail',
    'pickup_point',
    'other'
);


ALTER TYPE public.objecttype OWNER TO yms;

--
-- Name: transporttype; Type: TYPE; Schema: public; Owner: yms
--

CREATE TYPE public.transporttype AS ENUM (
    'own_production',
    'purchased',
    'container',
    'return_goods'
);


ALTER TYPE public.transporttype OWNER TO yms;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: yms
--

CREATE TYPE public.userrole AS ENUM (
    'admin',
    'carrier'
);


ALTER TYPE public.userrole OWNER TO yms;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_time_slots; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.booking_time_slots (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    time_slot_id integer NOT NULL
);


ALTER TABLE public.booking_time_slots OWNER TO yms;

--
-- Name: booking_time_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.booking_time_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_time_slots_id_seq OWNER TO yms;

--
-- Name: booking_time_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.booking_time_slots_id_seq OWNED BY public.booking_time_slots.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    vehicle_type_id integer NOT NULL,
    vehicle_plate character varying(20) NOT NULL,
    driver_full_name character varying(150) NOT NULL,
    driver_phone character varying(30) NOT NULL,
    supplier_id integer,
    zone_id integer,
    transport_type_id integer,
    cubes double precision,
    transport_sheet character varying(20),
    status character varying(20) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.bookings OWNER TO yms;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO yms;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: dock_transport_type_association; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.dock_transport_type_association (
    dock_id integer NOT NULL,
    transport_type_id integer NOT NULL
);


ALTER TABLE public.dock_transport_type_association OWNER TO yms;

--
-- Name: dock_zone_association; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.dock_zone_association (
    dock_id integer NOT NULL,
    zone_id integer NOT NULL
);


ALTER TABLE public.dock_zone_association OWNER TO yms;

--
-- Name: docks; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.docks (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    status public.dockstatus NOT NULL,
    length_meters integer,
    width_meters integer,
    max_load_kg integer,
    dock_type public.docktype NOT NULL,
    object_id integer NOT NULL
);


ALTER TABLE public.docks OWNER TO yms;

--
-- Name: docks_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.docks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.docks_id_seq OWNER TO yms;

--
-- Name: docks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.docks_id_seq OWNED BY public.docks.id;


--
-- Name: objects; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.objects (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    object_type public.objecttype NOT NULL,
    address character varying(255),
    capacity_in integer,
    capacity_out integer
);


ALTER TABLE public.objects OWNER TO yms;

--
-- Name: objects_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.objects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.objects_id_seq OWNER TO yms;

--
-- Name: objects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.objects_id_seq OWNED BY public.objects.id;


--
-- Name: prr_limits; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.prr_limits (
    id integer NOT NULL,
    object_id integer NOT NULL,
    supplier_id integer,
    transport_type_id integer,
    vehicle_type_id integer,
    duration_minutes integer NOT NULL
);


ALTER TABLE public.prr_limits OWNER TO yms;

--
-- Name: prr_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.prr_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.prr_limits_id_seq OWNER TO yms;

--
-- Name: prr_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.prr_limits_id_seq OWNED BY public.prr_limits.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    comment text,
    zone_id integer NOT NULL,
    transport_type_id integer
);


ALTER TABLE public.suppliers OWNER TO yms;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO yms;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: time_slots; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.time_slots (
    id integer NOT NULL,
    dock_id integer NOT NULL,
    slot_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    capacity integer NOT NULL,
    is_available boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.time_slots OWNER TO yms;

--
-- Name: time_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.time_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.time_slots_id_seq OWNER TO yms;

--
-- Name: time_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.time_slots_id_seq OWNED BY public.time_slots.id;


--
-- Name: transport_types; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.transport_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    enum_value public.transporttype NOT NULL
);


ALTER TABLE public.transport_types OWNER TO yms;

--
-- Name: transport_types_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.transport_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_types_id_seq OWNER TO yms;

--
-- Name: transport_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.transport_types_id_seq OWNED BY public.transport_types.id;


--
-- Name: user_supplier_relations; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.user_supplier_relations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    supplier_id integer NOT NULL
);


ALTER TABLE public.user_supplier_relations OWNER TO yms;

--
-- Name: user_supplier_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.user_supplier_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_supplier_relations_id_seq OWNER TO yms;

--
-- Name: user_supplier_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.user_supplier_relations_id_seq OWNED BY public.user_supplier_relations.id;


--
-- Name: user_suppliers; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.user_suppliers (
    user_id integer NOT NULL,
    supplier_id integer NOT NULL
);


ALTER TABLE public.user_suppliers OWNER TO yms;

--
-- Name: users; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.userrole NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO yms;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO yms;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicle_types; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.vehicle_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    duration_minutes integer NOT NULL
);


ALTER TABLE public.vehicle_types OWNER TO yms;

--
-- Name: vehicle_types_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.vehicle_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_types_id_seq OWNER TO yms;

--
-- Name: vehicle_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.vehicle_types_id_seq OWNED BY public.vehicle_types.id;


--
-- Name: work_schedules; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.work_schedules (
    id integer NOT NULL,
    day_of_week integer NOT NULL,
    dock_id integer NOT NULL,
    work_start time without time zone,
    work_end time without time zone,
    break_start time without time zone,
    break_end time without time zone,
    is_working_day boolean NOT NULL,
    capacity integer NOT NULL
);


ALTER TABLE public.work_schedules OWNER TO yms;

--
-- Name: work_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.work_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_schedules_id_seq OWNER TO yms;

--
-- Name: work_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.work_schedules_id_seq OWNED BY public.work_schedules.id;


--
-- Name: zones; Type: TABLE; Schema: public; Owner: yms
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.zones OWNER TO yms;

--
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: yms
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zones_id_seq OWNER TO yms;

--
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yms
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- Name: booking_time_slots id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.booking_time_slots ALTER COLUMN id SET DEFAULT nextval('public.booking_time_slots_id_seq'::regclass);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: docks id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.docks ALTER COLUMN id SET DEFAULT nextval('public.docks_id_seq'::regclass);


--
-- Name: objects id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.objects ALTER COLUMN id SET DEFAULT nextval('public.objects_id_seq'::regclass);


--
-- Name: prr_limits id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits ALTER COLUMN id SET DEFAULT nextval('public.prr_limits_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: time_slots id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.time_slots ALTER COLUMN id SET DEFAULT nextval('public.time_slots_id_seq'::regclass);


--
-- Name: transport_types id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.transport_types ALTER COLUMN id SET DEFAULT nextval('public.transport_types_id_seq'::regclass);


--
-- Name: user_supplier_relations id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_supplier_relations ALTER COLUMN id SET DEFAULT nextval('public.user_supplier_relations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicle_types id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.vehicle_types ALTER COLUMN id SET DEFAULT nextval('public.vehicle_types_id_seq'::regclass);


--
-- Name: work_schedules id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.work_schedules ALTER COLUMN id SET DEFAULT nextval('public.work_schedules_id_seq'::regclass);


--
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- Data for Name: booking_time_slots; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.booking_time_slots (id, booking_id, time_slot_id) FROM stdin;
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.bookings (id, user_id, vehicle_type_id, vehicle_plate, driver_full_name, driver_phone, supplier_id, zone_id, transport_type_id, cubes, transport_sheet, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dock_transport_type_association; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.dock_transport_type_association (dock_id, transport_type_id) FROM stdin;
\.


--
-- Data for Name: dock_zone_association; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.dock_zone_association (dock_id, zone_id) FROM stdin;
\.


--
-- Data for Name: docks; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.docks (id, name, status, length_meters, width_meters, max_load_kg, dock_type, object_id) FROM stdin;
1	Dock 1	active	\N	\N	\N	universal	1
2	Dock 2	active	\N	\N	\N	universal	1
3	Dock 3	maintenance	\N	\N	\N	universal	1
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.objects (id, name, object_type, address, capacity_in, capacity_out) FROM stdin;
1	Обухово	warehouse	142440, МО, Ногинский р-н, п. Обухово, Кудиновское ш., д. 4	\N	\N
2	Аксон	warehouse	Ногинский р-н, п. Аксено-Бутырское	\N	\N
\.


--
-- Data for Name: prr_limits; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.prr_limits (id, object_id, supplier_id, transport_type_id, vehicle_type_id, duration_minutes) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.suppliers (id, name, comment, zone_id, transport_type_id) FROM stdin;
1	Аскона	Собственный поставщик	1	\N
2	ООО 'Мебель Про'	Основной поставщик мебели	1	\N
3	ИП Иванов И.И.	Поставщик аксессуаров	3	\N
4	ЗАО 'Импорт Трейд'	Импортные поставщики	4	\N
5	ООО 'Кровати Плюс'	Специализация на кроватях	2	\N
\.


--
-- Data for Name: time_slots; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.time_slots (id, dock_id, slot_date, start_time, end_time, capacity, is_available, created_at, updated_at) FROM stdin;
1	1	2025-12-24	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401044	2025-12-24 12:48:34.401048
2	1	2025-12-24	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401051	2025-12-24 12:48:34.401052
3	1	2025-12-24	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401052	2025-12-24 12:48:34.401052
4	1	2025-12-24	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401053	2025-12-24 12:48:34.401053
5	1	2025-12-24	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401054	2025-12-24 12:48:34.401054
6	1	2025-12-24	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401054	2025-12-24 12:48:34.401055
7	1	2025-12-24	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401055	2025-12-24 12:48:34.401055
8	1	2025-12-24	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401056	2025-12-24 12:48:34.401056
9	1	2025-12-24	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401056	2025-12-24 12:48:34.401057
10	1	2025-12-24	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401057	2025-12-24 12:48:34.401057
11	1	2025-12-24	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401058	2025-12-24 12:48:34.401058
12	1	2025-12-24	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401058	2025-12-24 12:48:34.401058
13	1	2025-12-24	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401059	2025-12-24 12:48:34.401059
14	1	2025-12-24	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401059	2025-12-24 12:48:34.401059
15	1	2025-12-24	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.40106	2025-12-24 12:48:34.40106
16	1	2025-12-24	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.40106	2025-12-24 12:48:34.401061
17	2	2025-12-24	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401061	2025-12-24 12:48:34.401061
18	2	2025-12-24	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401062	2025-12-24 12:48:34.401062
19	2	2025-12-24	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401062	2025-12-24 12:48:34.401062
20	2	2025-12-24	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401063	2025-12-24 12:48:34.401063
21	2	2025-12-24	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401063	2025-12-24 12:48:34.401063
22	2	2025-12-24	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401064	2025-12-24 12:48:34.401064
23	2	2025-12-24	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401064	2025-12-24 12:48:34.401065
24	2	2025-12-24	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401065	2025-12-24 12:48:34.401065
25	2	2025-12-24	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401066	2025-12-24 12:48:34.401066
26	2	2025-12-24	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401066	2025-12-24 12:48:34.401066
27	2	2025-12-24	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401067	2025-12-24 12:48:34.401067
28	2	2025-12-24	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401067	2025-12-24 12:48:34.401068
29	2	2025-12-24	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401068	2025-12-24 12:48:34.401068
30	2	2025-12-24	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401069	2025-12-24 12:48:34.401069
31	2	2025-12-24	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401069	2025-12-24 12:48:34.401069
32	2	2025-12-24	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.40107	2025-12-24 12:48:34.40107
33	3	2025-12-24	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.40107	2025-12-24 12:48:34.40107
34	3	2025-12-24	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401071	2025-12-24 12:48:34.401071
35	3	2025-12-24	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401071	2025-12-24 12:48:34.401072
36	3	2025-12-24	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401072	2025-12-24 12:48:34.401072
37	3	2025-12-24	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401072	2025-12-24 12:48:34.401073
38	3	2025-12-24	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401073	2025-12-24 12:48:34.401073
39	3	2025-12-24	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401074	2025-12-24 12:48:34.401074
40	3	2025-12-24	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401074	2025-12-24 12:48:34.401074
41	3	2025-12-24	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401075	2025-12-24 12:48:34.401075
42	3	2025-12-24	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401075	2025-12-24 12:48:34.401075
43	3	2025-12-24	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401076	2025-12-24 12:48:34.401076
44	3	2025-12-24	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401076	2025-12-24 12:48:34.401077
45	3	2025-12-24	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401077	2025-12-24 12:48:34.401077
46	3	2025-12-24	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401078	2025-12-24 12:48:34.401078
47	3	2025-12-24	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401078	2025-12-24 12:48:34.401078
48	3	2025-12-24	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401079	2025-12-24 12:48:34.401079
49	1	2025-12-25	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401079	2025-12-24 12:48:34.40108
50	1	2025-12-25	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40108	2025-12-24 12:48:34.40108
51	1	2025-12-25	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40108	2025-12-24 12:48:34.401081
52	1	2025-12-25	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401081	2025-12-24 12:48:34.401081
53	1	2025-12-25	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401081	2025-12-24 12:48:34.401082
54	1	2025-12-25	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401082	2025-12-24 12:48:34.401082
55	1	2025-12-25	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401083	2025-12-24 12:48:34.401083
56	1	2025-12-25	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401083	2025-12-24 12:48:34.401083
57	1	2025-12-25	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401084	2025-12-24 12:48:34.401084
58	1	2025-12-25	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401084	2025-12-24 12:48:34.401085
59	1	2025-12-25	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401085	2025-12-24 12:48:34.401085
60	1	2025-12-25	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401085	2025-12-24 12:48:34.401086
61	1	2025-12-25	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401086	2025-12-24 12:48:34.401086
62	1	2025-12-25	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401086	2025-12-24 12:48:34.401087
63	1	2025-12-25	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401087	2025-12-24 12:48:34.401087
64	1	2025-12-25	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401088	2025-12-24 12:48:34.401088
65	2	2025-12-25	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401088	2025-12-24 12:48:34.401088
66	2	2025-12-25	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401089	2025-12-24 12:48:34.401089
67	2	2025-12-25	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401089	2025-12-24 12:48:34.40109
68	2	2025-12-25	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40109	2025-12-24 12:48:34.40109
69	2	2025-12-25	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.40109	2025-12-24 12:48:34.401091
70	2	2025-12-25	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401091	2025-12-24 12:48:34.401091
71	2	2025-12-25	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401092	2025-12-24 12:48:34.401092
72	2	2025-12-25	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401092	2025-12-24 12:48:34.401093
73	2	2025-12-25	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401093	2025-12-24 12:48:34.401093
74	2	2025-12-25	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401093	2025-12-24 12:48:34.401094
75	2	2025-12-25	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401094	2025-12-24 12:48:34.401094
76	2	2025-12-25	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401094	2025-12-24 12:48:34.401095
77	2	2025-12-25	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401095	2025-12-24 12:48:34.401095
78	2	2025-12-25	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401096	2025-12-24 12:48:34.401096
79	2	2025-12-25	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401096	2025-12-24 12:48:34.401096
80	2	2025-12-25	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401097	2025-12-24 12:48:34.401097
81	3	2025-12-25	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401097	2025-12-24 12:48:34.401097
82	3	2025-12-25	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401098	2025-12-24 12:48:34.401098
83	3	2025-12-25	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401098	2025-12-24 12:48:34.401099
84	3	2025-12-25	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401099	2025-12-24 12:48:34.401099
85	3	2025-12-25	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401099	2025-12-24 12:48:34.4011
86	3	2025-12-25	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.4011	2025-12-24 12:48:34.4011
87	3	2025-12-25	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401101	2025-12-24 12:48:34.401101
88	3	2025-12-25	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401101	2025-12-24 12:48:34.401101
89	3	2025-12-25	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401102	2025-12-24 12:48:34.401102
90	3	2025-12-25	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401102	2025-12-24 12:48:34.401102
91	3	2025-12-25	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401103	2025-12-24 12:48:34.401103
92	3	2025-12-25	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401103	2025-12-24 12:48:34.401104
93	3	2025-12-25	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401104	2025-12-24 12:48:34.401104
94	3	2025-12-25	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401104	2025-12-24 12:48:34.401105
95	3	2025-12-25	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401105	2025-12-24 12:48:34.401105
96	3	2025-12-25	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401105	2025-12-24 12:48:34.401106
97	1	2025-12-26	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401106	2025-12-24 12:48:34.401106
98	1	2025-12-26	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401107	2025-12-24 12:48:34.401107
99	1	2025-12-26	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401107	2025-12-24 12:48:34.401107
100	1	2025-12-26	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401108	2025-12-24 12:48:34.401108
101	1	2025-12-26	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401108	2025-12-24 12:48:34.401108
102	1	2025-12-26	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401109	2025-12-24 12:48:34.401109
103	1	2025-12-26	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401109	2025-12-24 12:48:34.40111
104	1	2025-12-26	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40111	2025-12-24 12:48:34.40111
105	1	2025-12-26	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40111	2025-12-24 12:48:34.401111
106	1	2025-12-26	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401111	2025-12-24 12:48:34.401111
107	1	2025-12-26	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401112	2025-12-24 12:48:34.401112
108	1	2025-12-26	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401112	2025-12-24 12:48:34.401112
109	1	2025-12-26	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401113	2025-12-24 12:48:34.401113
110	1	2025-12-26	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401113	2025-12-24 12:48:34.401113
111	1	2025-12-26	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401114	2025-12-24 12:48:34.401114
112	1	2025-12-26	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401114	2025-12-24 12:48:34.401115
113	2	2025-12-26	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401115	2025-12-24 12:48:34.401116
114	2	2025-12-26	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401116	2025-12-24 12:48:34.401118
115	2	2025-12-26	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401118	2025-12-24 12:48:34.401119
116	2	2025-12-26	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401119	2025-12-24 12:48:34.401119
117	2	2025-12-26	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.40112	2025-12-24 12:48:34.40112
118	2	2025-12-26	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.40112	2025-12-24 12:48:34.40112
119	2	2025-12-26	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401121	2025-12-24 12:48:34.401121
120	2	2025-12-26	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401121	2025-12-24 12:48:34.401122
121	2	2025-12-26	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401122	2025-12-24 12:48:34.401122
122	2	2025-12-26	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401123	2025-12-24 12:48:34.401123
123	2	2025-12-26	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401123	2025-12-24 12:48:34.401123
124	2	2025-12-26	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401124	2025-12-24 12:48:34.401124
125	2	2025-12-26	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401124	2025-12-24 12:48:34.401125
126	2	2025-12-26	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401125	2025-12-24 12:48:34.401125
127	2	2025-12-26	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401125	2025-12-24 12:48:34.401126
128	2	2025-12-26	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401126	2025-12-24 12:48:34.401126
129	3	2025-12-26	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401127	2025-12-24 12:48:34.401127
130	3	2025-12-26	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401127	2025-12-24 12:48:34.401127
131	3	2025-12-26	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401128	2025-12-24 12:48:34.401128
132	3	2025-12-26	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401128	2025-12-24 12:48:34.401129
133	3	2025-12-26	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401129	2025-12-24 12:48:34.401129
134	3	2025-12-26	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401129	2025-12-24 12:48:34.40113
135	3	2025-12-26	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.40113	2025-12-24 12:48:34.40113
136	3	2025-12-26	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401131	2025-12-24 12:48:34.401131
137	3	2025-12-26	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401131	2025-12-24 12:48:34.401131
138	3	2025-12-26	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401132	2025-12-24 12:48:34.401132
139	3	2025-12-26	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401132	2025-12-24 12:48:34.401133
140	3	2025-12-26	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401133	2025-12-24 12:48:34.401133
141	3	2025-12-26	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401133	2025-12-24 12:48:34.401134
142	3	2025-12-26	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401134	2025-12-24 12:48:34.401134
143	3	2025-12-26	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401135	2025-12-24 12:48:34.401135
144	3	2025-12-26	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401135	2025-12-24 12:48:34.401135
145	1	2025-12-29	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401136	2025-12-24 12:48:34.401136
146	1	2025-12-29	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401136	2025-12-24 12:48:34.401137
147	1	2025-12-29	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401137	2025-12-24 12:48:34.401137
148	1	2025-12-29	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401137	2025-12-24 12:48:34.401138
149	1	2025-12-29	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401138	2025-12-24 12:48:34.401138
150	1	2025-12-29	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401139	2025-12-24 12:48:34.401139
151	1	2025-12-29	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401139	2025-12-24 12:48:34.401139
152	1	2025-12-29	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40114	2025-12-24 12:48:34.40114
153	1	2025-12-29	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40114	2025-12-24 12:48:34.40114
154	1	2025-12-29	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401141	2025-12-24 12:48:34.401141
155	1	2025-12-29	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401141	2025-12-24 12:48:34.401142
156	1	2025-12-29	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401142	2025-12-24 12:48:34.401143
157	1	2025-12-29	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401144	2025-12-24 12:48:34.401144
158	1	2025-12-29	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401144	2025-12-24 12:48:34.401145
159	1	2025-12-29	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401145	2025-12-24 12:48:34.401145
160	1	2025-12-29	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401145	2025-12-24 12:48:34.401146
161	2	2025-12-29	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401146	2025-12-24 12:48:34.401146
162	2	2025-12-29	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401146	2025-12-24 12:48:34.401147
163	2	2025-12-29	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401147	2025-12-24 12:48:34.401147
164	2	2025-12-29	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401148	2025-12-24 12:48:34.401148
165	2	2025-12-29	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401148	2025-12-24 12:48:34.401148
166	2	2025-12-29	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401149	2025-12-24 12:48:34.401149
167	2	2025-12-29	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401149	2025-12-24 12:48:34.401149
168	2	2025-12-29	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40115	2025-12-24 12:48:34.40115
169	2	2025-12-29	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40115	2025-12-24 12:48:34.401151
170	2	2025-12-29	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401151	2025-12-24 12:48:34.401151
171	2	2025-12-29	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401151	2025-12-24 12:48:34.401152
172	2	2025-12-29	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401152	2025-12-24 12:48:34.401152
173	2	2025-12-29	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401153	2025-12-24 12:48:34.401153
174	2	2025-12-29	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401153	2025-12-24 12:48:34.401153
175	2	2025-12-29	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401154	2025-12-24 12:48:34.401154
176	2	2025-12-29	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401154	2025-12-24 12:48:34.401154
177	3	2025-12-29	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401155	2025-12-24 12:48:34.401155
178	3	2025-12-29	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401155	2025-12-24 12:48:34.401156
179	3	2025-12-29	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401156	2025-12-24 12:48:34.401156
180	3	2025-12-29	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401156	2025-12-24 12:48:34.401157
181	3	2025-12-29	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401157	2025-12-24 12:48:34.401157
182	3	2025-12-29	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401158	2025-12-24 12:48:34.401158
183	3	2025-12-29	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401158	2025-12-24 12:48:34.401158
184	3	2025-12-29	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401159	2025-12-24 12:48:34.401159
185	3	2025-12-29	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401159	2025-12-24 12:48:34.401159
186	3	2025-12-29	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40116	2025-12-24 12:48:34.40116
187	3	2025-12-29	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40116	2025-12-24 12:48:34.401161
188	3	2025-12-29	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401161	2025-12-24 12:48:34.401161
189	3	2025-12-29	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401161	2025-12-24 12:48:34.401162
190	3	2025-12-29	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401162	2025-12-24 12:48:34.401162
191	3	2025-12-29	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401163	2025-12-24 12:48:34.401163
192	3	2025-12-29	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401163	2025-12-24 12:48:34.401164
193	1	2025-12-30	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401164	2025-12-24 12:48:34.401164
194	1	2025-12-30	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401164	2025-12-24 12:48:34.401165
195	1	2025-12-30	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401165	2025-12-24 12:48:34.401165
196	1	2025-12-30	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401166	2025-12-24 12:48:34.401166
197	1	2025-12-30	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401166	2025-12-24 12:48:34.401167
198	1	2025-12-30	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401167	2025-12-24 12:48:34.401167
199	1	2025-12-30	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401169	2025-12-24 12:48:34.401169
200	1	2025-12-30	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401169	2025-12-24 12:48:34.40117
201	1	2025-12-30	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40117	2025-12-24 12:48:34.40117
202	1	2025-12-30	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401171	2025-12-24 12:48:34.401171
203	1	2025-12-30	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401171	2025-12-24 12:48:34.401171
204	1	2025-12-30	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401172	2025-12-24 12:48:34.401172
205	1	2025-12-30	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401172	2025-12-24 12:48:34.401172
206	1	2025-12-30	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401173	2025-12-24 12:48:34.401173
207	1	2025-12-30	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401173	2025-12-24 12:48:34.401174
208	1	2025-12-30	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401174	2025-12-24 12:48:34.401174
209	2	2025-12-30	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401175	2025-12-24 12:48:34.401175
210	2	2025-12-30	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401175	2025-12-24 12:48:34.401175
211	2	2025-12-30	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401176	2025-12-24 12:48:34.401176
212	2	2025-12-30	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401176	2025-12-24 12:48:34.401177
213	2	2025-12-30	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401177	2025-12-24 12:48:34.401177
214	2	2025-12-30	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401178	2025-12-24 12:48:34.401178
215	2	2025-12-30	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401178	2025-12-24 12:48:34.401178
216	2	2025-12-30	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401179	2025-12-24 12:48:34.401179
217	2	2025-12-30	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401179	2025-12-24 12:48:34.401179
218	2	2025-12-30	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40118	2025-12-24 12:48:34.40118
219	2	2025-12-30	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40118	2025-12-24 12:48:34.401181
220	2	2025-12-30	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401181	2025-12-24 12:48:34.401181
221	2	2025-12-30	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401181	2025-12-24 12:48:34.401182
222	2	2025-12-30	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401182	2025-12-24 12:48:34.401182
223	2	2025-12-30	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401183	2025-12-24 12:48:34.401183
224	2	2025-12-30	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401183	2025-12-24 12:48:34.401183
225	3	2025-12-30	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401184	2025-12-24 12:48:34.401184
226	3	2025-12-30	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401184	2025-12-24 12:48:34.401184
227	3	2025-12-30	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401185	2025-12-24 12:48:34.401185
228	3	2025-12-30	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401185	2025-12-24 12:48:34.401186
229	3	2025-12-30	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401186	2025-12-24 12:48:34.401186
230	3	2025-12-30	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401186	2025-12-24 12:48:34.401187
231	3	2025-12-30	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401187	2025-12-24 12:48:34.401187
232	3	2025-12-30	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401187	2025-12-24 12:48:34.401188
233	3	2025-12-30	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401188	2025-12-24 12:48:34.401188
234	3	2025-12-30	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401189	2025-12-24 12:48:34.401189
235	3	2025-12-30	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401189	2025-12-24 12:48:34.401189
236	3	2025-12-30	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.40119	2025-12-24 12:48:34.40119
237	3	2025-12-30	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.40119	2025-12-24 12:48:34.40119
238	3	2025-12-30	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401191	2025-12-24 12:48:34.401191
239	3	2025-12-30	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401191	2025-12-24 12:48:34.401192
240	3	2025-12-30	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401192	2025-12-24 12:48:34.401192
241	1	2025-12-31	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401192	2025-12-24 12:48:34.401228
242	1	2025-12-31	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401229	2025-12-24 12:48:34.401229
243	1	2025-12-31	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40123	2025-12-24 12:48:34.40123
244	1	2025-12-31	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40123	2025-12-24 12:48:34.401231
245	1	2025-12-31	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401231	2025-12-24 12:48:34.401231
246	1	2025-12-31	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401232	2025-12-24 12:48:34.401232
247	1	2025-12-31	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401232	2025-12-24 12:48:34.401233
248	1	2025-12-31	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401233	2025-12-24 12:48:34.401233
249	1	2025-12-31	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401233	2025-12-24 12:48:34.401234
250	1	2025-12-31	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401234	2025-12-24 12:48:34.401235
251	1	2025-12-31	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401235	2025-12-24 12:48:34.401235
252	1	2025-12-31	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401236	2025-12-24 12:48:34.401236
253	1	2025-12-31	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401236	2025-12-24 12:48:34.401236
254	1	2025-12-31	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401237	2025-12-24 12:48:34.401237
255	1	2025-12-31	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401237	2025-12-24 12:48:34.401238
256	1	2025-12-31	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401238	2025-12-24 12:48:34.401238
257	2	2025-12-31	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401239	2025-12-24 12:48:34.401239
258	2	2025-12-31	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401239	2025-12-24 12:48:34.401239
259	2	2025-12-31	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40124	2025-12-24 12:48:34.40124
260	2	2025-12-31	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40124	2025-12-24 12:48:34.401241
261	2	2025-12-31	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401241	2025-12-24 12:48:34.401241
262	2	2025-12-31	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401242	2025-12-24 12:48:34.401242
263	2	2025-12-31	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401242	2025-12-24 12:48:34.401242
264	2	2025-12-31	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401243	2025-12-24 12:48:34.401243
265	2	2025-12-31	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401243	2025-12-24 12:48:34.401244
266	2	2025-12-31	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401244	2025-12-24 12:48:34.401244
267	2	2025-12-31	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401244	2025-12-24 12:48:34.401245
268	2	2025-12-31	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401245	2025-12-24 12:48:34.401245
269	2	2025-12-31	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401246	2025-12-24 12:48:34.401246
270	2	2025-12-31	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401246	2025-12-24 12:48:34.401246
271	2	2025-12-31	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401247	2025-12-24 12:48:34.401247
272	2	2025-12-31	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401247	2025-12-24 12:48:34.401248
273	3	2025-12-31	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401248	2025-12-24 12:48:34.401248
274	3	2025-12-31	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401248	2025-12-24 12:48:34.401249
275	3	2025-12-31	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401249	2025-12-24 12:48:34.401249
276	3	2025-12-31	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40125	2025-12-24 12:48:34.40125
277	3	2025-12-31	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.40125	2025-12-24 12:48:34.40125
278	3	2025-12-31	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401251	2025-12-24 12:48:34.401251
279	3	2025-12-31	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401251	2025-12-24 12:48:34.401252
280	3	2025-12-31	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401252	2025-12-24 12:48:34.401252
281	3	2025-12-31	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401253	2025-12-24 12:48:34.401253
282	3	2025-12-31	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401253	2025-12-24 12:48:34.401254
283	3	2025-12-31	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401254	2025-12-24 12:48:34.401254
284	3	2025-12-31	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401255	2025-12-24 12:48:34.401257
285	3	2025-12-31	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401257	2025-12-24 12:48:34.401258
286	3	2025-12-31	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401258	2025-12-24 12:48:34.401258
287	3	2025-12-31	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401258	2025-12-24 12:48:34.401259
288	3	2025-12-31	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401259	2025-12-24 12:48:34.401259
289	1	2026-01-01	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401281	2025-12-24 12:48:34.401281
290	1	2026-01-01	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401281	2025-12-24 12:48:34.401281
291	1	2026-01-01	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401282	2025-12-24 12:48:34.401282
292	1	2026-01-01	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401282	2025-12-24 12:48:34.401283
293	1	2026-01-01	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401283	2025-12-24 12:48:34.401283
294	1	2026-01-01	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401283	2025-12-24 12:48:34.401284
295	1	2026-01-01	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401284	2025-12-24 12:48:34.401284
296	1	2026-01-01	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401285	2025-12-24 12:48:34.401285
297	1	2026-01-01	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401285	2025-12-24 12:48:34.401285
298	1	2026-01-01	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401286	2025-12-24 12:48:34.401286
299	1	2026-01-01	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401286	2025-12-24 12:48:34.401286
300	1	2026-01-01	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401287	2025-12-24 12:48:34.401287
301	1	2026-01-01	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401287	2025-12-24 12:48:34.401287
302	1	2026-01-01	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401288	2025-12-24 12:48:34.401288
303	1	2026-01-01	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401288	2025-12-24 12:48:34.401288
304	1	2026-01-01	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401289	2025-12-24 12:48:34.401289
305	2	2026-01-01	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401289	2025-12-24 12:48:34.40129
306	2	2026-01-01	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40129	2025-12-24 12:48:34.40129
307	2	2026-01-01	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40129	2025-12-24 12:48:34.401291
308	2	2026-01-01	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401291	2025-12-24 12:48:34.401291
309	2	2026-01-01	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401292	2025-12-24 12:48:34.401292
310	2	2026-01-01	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401292	2025-12-24 12:48:34.401292
311	2	2026-01-01	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401293	2025-12-24 12:48:34.401293
312	2	2026-01-01	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401293	2025-12-24 12:48:34.401293
313	2	2026-01-01	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401294	2025-12-24 12:48:34.401294
314	2	2026-01-01	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401294	2025-12-24 12:48:34.401294
315	2	2026-01-01	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401295	2025-12-24 12:48:34.401295
316	2	2026-01-01	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401295	2025-12-24 12:48:34.401296
317	2	2026-01-01	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401296	2025-12-24 12:48:34.401296
318	2	2026-01-01	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401296	2025-12-24 12:48:34.401297
319	2	2026-01-01	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401297	2025-12-24 12:48:34.401297
320	2	2026-01-01	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401298	2025-12-24 12:48:34.401298
321	3	2026-01-01	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401298	2025-12-24 12:48:34.401298
322	3	2026-01-01	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401299	2025-12-24 12:48:34.401299
323	3	2026-01-01	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401299	2025-12-24 12:48:34.401299
324	3	2026-01-01	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.4013	2025-12-24 12:48:34.4013
325	3	2026-01-01	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.4013	2025-12-24 12:48:34.4013
326	3	2026-01-01	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401301	2025-12-24 12:48:34.401304
327	3	2026-01-01	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401304	2025-12-24 12:48:34.401304
328	3	2026-01-01	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401305	2025-12-24 12:48:34.401305
329	3	2026-01-01	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401305	2025-12-24 12:48:34.401306
330	3	2026-01-01	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401306	2025-12-24 12:48:34.401306
331	3	2026-01-01	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401307	2025-12-24 12:48:34.401307
332	3	2026-01-01	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401307	2025-12-24 12:48:34.401307
333	3	2026-01-01	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401308	2025-12-24 12:48:34.401308
334	3	2026-01-01	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401308	2025-12-24 12:48:34.401309
335	3	2026-01-01	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401309	2025-12-24 12:48:34.401309
336	3	2026-01-01	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401309	2025-12-24 12:48:34.40131
337	1	2026-01-02	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.40131	2025-12-24 12:48:34.40131
338	1	2026-01-02	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40131	2025-12-24 12:48:34.401311
339	1	2026-01-02	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401311	2025-12-24 12:48:34.401311
340	1	2026-01-02	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401312	2025-12-24 12:48:34.401312
341	1	2026-01-02	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401312	2025-12-24 12:48:34.401312
342	1	2026-01-02	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401313	2025-12-24 12:48:34.401313
343	1	2026-01-02	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401313	2025-12-24 12:48:34.401313
344	1	2026-01-02	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401314	2025-12-24 12:48:34.401314
345	1	2026-01-02	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401314	2025-12-24 12:48:34.401315
346	1	2026-01-02	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401315	2025-12-24 12:48:34.401315
347	1	2026-01-02	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401316	2025-12-24 12:48:34.401316
348	1	2026-01-02	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401316	2025-12-24 12:48:34.401316
349	1	2026-01-02	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401317	2025-12-24 12:48:34.401317
350	1	2026-01-02	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401317	2025-12-24 12:48:34.401318
351	1	2026-01-02	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401318	2025-12-24 12:48:34.401318
352	1	2026-01-02	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401318	2025-12-24 12:48:34.401319
353	2	2026-01-02	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401319	2025-12-24 12:48:34.401319
354	2	2026-01-02	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40132	2025-12-24 12:48:34.40132
355	2	2026-01-02	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40132	2025-12-24 12:48:34.40132
356	2	2026-01-02	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401321	2025-12-24 12:48:34.401321
357	2	2026-01-02	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401321	2025-12-24 12:48:34.401321
358	2	2026-01-02	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401322	2025-12-24 12:48:34.401322
359	2	2026-01-02	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401322	2025-12-24 12:48:34.401322
360	2	2026-01-02	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401323	2025-12-24 12:48:34.401323
361	2	2026-01-02	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401323	2025-12-24 12:48:34.401323
362	2	2026-01-02	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401324	2025-12-24 12:48:34.401324
363	2	2026-01-02	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401324	2025-12-24 12:48:34.401325
364	2	2026-01-02	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401325	2025-12-24 12:48:34.401325
365	2	2026-01-02	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401325	2025-12-24 12:48:34.401326
366	2	2026-01-02	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401326	2025-12-24 12:48:34.401326
367	2	2026-01-02	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401327	2025-12-24 12:48:34.401327
368	2	2026-01-02	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401327	2025-12-24 12:48:34.401327
369	3	2026-01-02	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401329	2025-12-24 12:48:34.401329
370	3	2026-01-02	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40133	2025-12-24 12:48:34.40133
371	3	2026-01-02	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40133	2025-12-24 12:48:34.40133
372	3	2026-01-02	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401331	2025-12-24 12:48:34.401331
373	3	2026-01-02	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401331	2025-12-24 12:48:34.401332
374	3	2026-01-02	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401332	2025-12-24 12:48:34.401332
375	3	2026-01-02	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401332	2025-12-24 12:48:34.401333
376	3	2026-01-02	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401333	2025-12-24 12:48:34.401333
377	3	2026-01-02	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401334	2025-12-24 12:48:34.401334
378	3	2026-01-02	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401334	2025-12-24 12:48:34.401334
379	3	2026-01-02	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401335	2025-12-24 12:48:34.401335
380	3	2026-01-02	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401335	2025-12-24 12:48:34.401335
381	3	2026-01-02	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401336	2025-12-24 12:48:34.401336
382	3	2026-01-02	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401336	2025-12-24 12:48:34.401337
383	3	2026-01-02	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401337	2025-12-24 12:48:34.401337
384	3	2026-01-02	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401337	2025-12-24 12:48:34.401338
385	1	2026-01-05	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401338	2025-12-24 12:48:34.401338
386	1	2026-01-05	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401339	2025-12-24 12:48:34.401339
387	1	2026-01-05	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401339	2025-12-24 12:48:34.401339
388	1	2026-01-05	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40134	2025-12-24 12:48:34.40134
389	1	2026-01-05	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.40134	2025-12-24 12:48:34.40134
390	1	2026-01-05	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401341	2025-12-24 12:48:34.401341
391	1	2026-01-05	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401341	2025-12-24 12:48:34.401342
392	1	2026-01-05	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401342	2025-12-24 12:48:34.401342
393	1	2026-01-05	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401342	2025-12-24 12:48:34.401343
394	1	2026-01-05	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401343	2025-12-24 12:48:34.401343
395	1	2026-01-05	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401343	2025-12-24 12:48:34.401344
396	1	2026-01-05	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401344	2025-12-24 12:48:34.401344
397	1	2026-01-05	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401345	2025-12-24 12:48:34.401345
398	1	2026-01-05	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401345	2025-12-24 12:48:34.401345
399	1	2026-01-05	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401346	2025-12-24 12:48:34.401346
400	1	2026-01-05	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401346	2025-12-24 12:48:34.401347
401	2	2026-01-05	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401347	2025-12-24 12:48:34.401347
402	2	2026-01-05	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401347	2025-12-24 12:48:34.401348
403	2	2026-01-05	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401348	2025-12-24 12:48:34.401348
404	2	2026-01-05	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401349	2025-12-24 12:48:34.401349
405	2	2026-01-05	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401349	2025-12-24 12:48:34.401349
406	2	2026-01-05	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.40135	2025-12-24 12:48:34.40135
407	2	2026-01-05	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.40135	2025-12-24 12:48:34.40135
408	2	2026-01-05	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401351	2025-12-24 12:48:34.401351
409	2	2026-01-05	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401351	2025-12-24 12:48:34.401351
410	2	2026-01-05	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401352	2025-12-24 12:48:34.401352
411	2	2026-01-05	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401352	2025-12-24 12:48:34.401354
412	2	2026-01-05	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401354	2025-12-24 12:48:34.401354
413	2	2026-01-05	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401355	2025-12-24 12:48:34.401355
414	2	2026-01-05	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401355	2025-12-24 12:48:34.401356
415	2	2026-01-05	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401356	2025-12-24 12:48:34.401356
416	2	2026-01-05	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401357	2025-12-24 12:48:34.401357
417	3	2026-01-05	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401357	2025-12-24 12:48:34.401357
418	3	2026-01-05	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401358	2025-12-24 12:48:34.401358
419	3	2026-01-05	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401358	2025-12-24 12:48:34.401359
420	3	2026-01-05	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401359	2025-12-24 12:48:34.401359
421	3	2026-01-05	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401359	2025-12-24 12:48:34.40136
422	3	2026-01-05	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.40136	2025-12-24 12:48:34.40136
423	3	2026-01-05	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401361	2025-12-24 12:48:34.401361
424	3	2026-01-05	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401361	2025-12-24 12:48:34.401361
425	3	2026-01-05	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401362	2025-12-24 12:48:34.401362
426	3	2026-01-05	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401362	2025-12-24 12:48:34.401362
427	3	2026-01-05	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401363	2025-12-24 12:48:34.401363
428	3	2026-01-05	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401363	2025-12-24 12:48:34.401364
429	3	2026-01-05	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401364	2025-12-24 12:48:34.401364
430	3	2026-01-05	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401364	2025-12-24 12:48:34.401365
431	3	2026-01-05	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401365	2025-12-24 12:48:34.401365
432	3	2026-01-05	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401366	2025-12-24 12:48:34.401366
433	1	2026-01-06	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401366	2025-12-24 12:48:34.401366
434	1	2026-01-06	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401367	2025-12-24 12:48:34.401367
435	1	2026-01-06	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401367	2025-12-24 12:48:34.401368
436	1	2026-01-06	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401368	2025-12-24 12:48:34.401368
437	1	2026-01-06	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401368	2025-12-24 12:48:34.401369
438	1	2026-01-06	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401369	2025-12-24 12:48:34.401369
439	1	2026-01-06	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401369	2025-12-24 12:48:34.40137
440	1	2026-01-06	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40137	2025-12-24 12:48:34.40137
441	1	2026-01-06	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401371	2025-12-24 12:48:34.401371
442	1	2026-01-06	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401371	2025-12-24 12:48:34.401371
443	1	2026-01-06	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401372	2025-12-24 12:48:34.401372
444	1	2026-01-06	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401372	2025-12-24 12:48:34.401372
445	1	2026-01-06	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401373	2025-12-24 12:48:34.401373
446	1	2026-01-06	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401373	2025-12-24 12:48:34.401373
447	1	2026-01-06	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401374	2025-12-24 12:48:34.401374
448	1	2026-01-06	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401374	2025-12-24 12:48:34.401375
449	2	2026-01-06	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401375	2025-12-24 12:48:34.401375
450	2	2026-01-06	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401375	2025-12-24 12:48:34.401376
451	2	2026-01-06	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401376	2025-12-24 12:48:34.401376
452	2	2026-01-06	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401377	2025-12-24 12:48:34.401377
453	2	2026-01-06	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401377	2025-12-24 12:48:34.401377
454	2	2026-01-06	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401378	2025-12-24 12:48:34.401379
455	2	2026-01-06	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.40138	2025-12-24 12:48:34.40138
456	2	2026-01-06	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40138	2025-12-24 12:48:34.40138
457	2	2026-01-06	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401381	2025-12-24 12:48:34.401381
458	2	2026-01-06	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401381	2025-12-24 12:48:34.401382
459	2	2026-01-06	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401382	2025-12-24 12:48:34.401382
460	2	2026-01-06	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401382	2025-12-24 12:48:34.401383
461	2	2026-01-06	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401383	2025-12-24 12:48:34.401383
462	2	2026-01-06	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401383	2025-12-24 12:48:34.401384
463	2	2026-01-06	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401384	2025-12-24 12:48:34.401384
464	2	2026-01-06	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401385	2025-12-24 12:48:34.401385
465	3	2026-01-06	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401385	2025-12-24 12:48:34.401385
466	3	2026-01-06	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401386	2025-12-24 12:48:34.401386
467	3	2026-01-06	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401386	2025-12-24 12:48:34.401387
468	3	2026-01-06	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401387	2025-12-24 12:48:34.401387
469	3	2026-01-06	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401387	2025-12-24 12:48:34.401388
470	3	2026-01-06	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401388	2025-12-24 12:48:34.401388
471	3	2026-01-06	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401389	2025-12-24 12:48:34.401389
472	3	2026-01-06	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401389	2025-12-24 12:48:34.401389
473	3	2026-01-06	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40139	2025-12-24 12:48:34.40139
474	3	2026-01-06	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40139	2025-12-24 12:48:34.40139
475	3	2026-01-06	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401391	2025-12-24 12:48:34.401391
476	3	2026-01-06	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401391	2025-12-24 12:48:34.401392
477	3	2026-01-06	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401392	2025-12-24 12:48:34.401392
478	3	2026-01-06	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401392	2025-12-24 12:48:34.401393
479	3	2026-01-06	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401393	2025-12-24 12:48:34.401393
480	3	2026-01-06	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401393	2025-12-24 12:48:34.401394
481	1	2026-01-07	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401394	2025-12-24 12:48:34.401394
482	1	2026-01-07	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401395	2025-12-24 12:48:34.401395
483	1	2026-01-07	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401395	2025-12-24 12:48:34.401395
484	1	2026-01-07	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401396	2025-12-24 12:48:34.401396
485	1	2026-01-07	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401396	2025-12-24 12:48:34.401397
486	1	2026-01-07	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401397	2025-12-24 12:48:34.401397
487	1	2026-01-07	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401397	2025-12-24 12:48:34.401398
488	1	2026-01-07	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401398	2025-12-24 12:48:34.401398
489	1	2026-01-07	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401399	2025-12-24 12:48:34.401399
490	1	2026-01-07	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401399	2025-12-24 12:48:34.401399
491	1	2026-01-07	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.4014	2025-12-24 12:48:34.4014
492	1	2026-01-07	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.4014	2025-12-24 12:48:34.4014
493	1	2026-01-07	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401401	2025-12-24 12:48:34.401401
494	1	2026-01-07	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401401	2025-12-24 12:48:34.401402
495	1	2026-01-07	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401402	2025-12-24 12:48:34.401402
496	1	2026-01-07	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401402	2025-12-24 12:48:34.401502
497	2	2026-01-07	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401504	2025-12-24 12:48:34.401504
498	2	2026-01-07	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401505	2025-12-24 12:48:34.401505
499	2	2026-01-07	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401506	2025-12-24 12:48:34.401506
500	2	2026-01-07	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401507	2025-12-24 12:48:34.401507
501	2	2026-01-07	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401507	2025-12-24 12:48:34.401508
502	2	2026-01-07	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401508	2025-12-24 12:48:34.401508
503	2	2026-01-07	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401509	2025-12-24 12:48:34.401509
504	2	2026-01-07	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401509	2025-12-24 12:48:34.401509
505	2	2026-01-07	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40151	2025-12-24 12:48:34.40151
506	2	2026-01-07	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40151	2025-12-24 12:48:34.40151
507	2	2026-01-07	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401511	2025-12-24 12:48:34.401511
508	2	2026-01-07	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401511	2025-12-24 12:48:34.401512
509	2	2026-01-07	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401512	2025-12-24 12:48:34.401512
510	2	2026-01-07	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401513	2025-12-24 12:48:34.401513
511	2	2026-01-07	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401513	2025-12-24 12:48:34.401514
512	2	2026-01-07	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401514	2025-12-24 12:48:34.401515
513	3	2026-01-07	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401515	2025-12-24 12:48:34.401515
514	3	2026-01-07	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401515	2025-12-24 12:48:34.401516
515	3	2026-01-07	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401516	2025-12-24 12:48:34.401516
516	3	2026-01-07	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401516	2025-12-24 12:48:34.401517
517	3	2026-01-07	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401517	2025-12-24 12:48:34.401517
518	3	2026-01-07	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401518	2025-12-24 12:48:34.401518
519	3	2026-01-07	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401518	2025-12-24 12:48:34.401518
520	3	2026-01-07	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401519	2025-12-24 12:48:34.401519
521	3	2026-01-07	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401519	2025-12-24 12:48:34.40152
522	3	2026-01-07	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40152	2025-12-24 12:48:34.40152
523	3	2026-01-07	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40152	2025-12-24 12:48:34.401521
524	3	2026-01-07	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401521	2025-12-24 12:48:34.401521
525	3	2026-01-07	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401521	2025-12-24 12:48:34.401522
526	3	2026-01-07	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401522	2025-12-24 12:48:34.401522
527	3	2026-01-07	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401523	2025-12-24 12:48:34.401523
528	3	2026-01-07	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401523	2025-12-24 12:48:34.401523
529	1	2026-01-08	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401524	2025-12-24 12:48:34.401524
530	1	2026-01-08	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401524	2025-12-24 12:48:34.401524
531	1	2026-01-08	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401525	2025-12-24 12:48:34.401525
532	1	2026-01-08	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401525	2025-12-24 12:48:34.401526
533	1	2026-01-08	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401526	2025-12-24 12:48:34.401526
534	1	2026-01-08	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401527	2025-12-24 12:48:34.401527
535	1	2026-01-08	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401527	2025-12-24 12:48:34.401528
536	1	2026-01-08	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401528	2025-12-24 12:48:34.401528
537	1	2026-01-08	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401528	2025-12-24 12:48:34.401529
538	1	2026-01-08	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401529	2025-12-24 12:48:34.401529
539	1	2026-01-08	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401532	2025-12-24 12:48:34.401532
540	1	2026-01-08	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401532	2025-12-24 12:48:34.401532
541	1	2026-01-08	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401533	2025-12-24 12:48:34.401533
542	1	2026-01-08	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401533	2025-12-24 12:48:34.401533
543	1	2026-01-08	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401534	2025-12-24 12:48:34.401534
544	1	2026-01-08	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401534	2025-12-24 12:48:34.401535
545	2	2026-01-08	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401535	2025-12-24 12:48:34.401535
546	2	2026-01-08	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401535	2025-12-24 12:48:34.401536
547	2	2026-01-08	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401536	2025-12-24 12:48:34.401536
548	2	2026-01-08	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401537	2025-12-24 12:48:34.401537
549	2	2026-01-08	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401537	2025-12-24 12:48:34.401537
550	2	2026-01-08	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401538	2025-12-24 12:48:34.401538
551	2	2026-01-08	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401538	2025-12-24 12:48:34.401539
552	2	2026-01-08	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401539	2025-12-24 12:48:34.401539
553	2	2026-01-08	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40154	2025-12-24 12:48:34.40154
554	2	2026-01-08	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40154	2025-12-24 12:48:34.40154
555	2	2026-01-08	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401541	2025-12-24 12:48:34.401541
556	2	2026-01-08	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401541	2025-12-24 12:48:34.401542
557	2	2026-01-08	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401542	2025-12-24 12:48:34.401542
558	2	2026-01-08	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401542	2025-12-24 12:48:34.401543
559	2	2026-01-08	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401543	2025-12-24 12:48:34.401543
560	2	2026-01-08	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401544	2025-12-24 12:48:34.401544
561	3	2026-01-08	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401544	2025-12-24 12:48:34.401544
562	3	2026-01-08	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401545	2025-12-24 12:48:34.401545
563	3	2026-01-08	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401545	2025-12-24 12:48:34.401545
564	3	2026-01-08	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401546	2025-12-24 12:48:34.401546
565	3	2026-01-08	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401546	2025-12-24 12:48:34.401547
566	3	2026-01-08	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401547	2025-12-24 12:48:34.401547
567	3	2026-01-08	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401547	2025-12-24 12:48:34.401548
568	3	2026-01-08	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401548	2025-12-24 12:48:34.401548
569	3	2026-01-08	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401549	2025-12-24 12:48:34.401549
570	3	2026-01-08	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401549	2025-12-24 12:48:34.401549
571	3	2026-01-08	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40155	2025-12-24 12:48:34.40155
572	3	2026-01-08	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.40155	2025-12-24 12:48:34.40155
573	3	2026-01-08	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401551	2025-12-24 12:48:34.401551
574	3	2026-01-08	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401551	2025-12-24 12:48:34.401551
575	3	2026-01-08	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401552	2025-12-24 12:48:34.401552
576	3	2026-01-08	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401552	2025-12-24 12:48:34.401553
577	1	2026-01-09	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401553	2025-12-24 12:48:34.401553
578	1	2026-01-09	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401553	2025-12-24 12:48:34.401554
579	1	2026-01-09	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401554	2025-12-24 12:48:34.401554
580	1	2026-01-09	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401554	2025-12-24 12:48:34.401555
581	1	2026-01-09	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401555	2025-12-24 12:48:34.401557
582	1	2026-01-09	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401557	2025-12-24 12:48:34.401557
583	1	2026-01-09	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401558	2025-12-24 12:48:34.401558
584	1	2026-01-09	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401558	2025-12-24 12:48:34.401559
585	1	2026-01-09	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401559	2025-12-24 12:48:34.401559
586	1	2026-01-09	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401559	2025-12-24 12:48:34.40156
587	1	2026-01-09	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40156	2025-12-24 12:48:34.40156
588	1	2026-01-09	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401561	2025-12-24 12:48:34.401561
589	1	2026-01-09	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401561	2025-12-24 12:48:34.401561
590	1	2026-01-09	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401562	2025-12-24 12:48:34.401562
591	1	2026-01-09	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401562	2025-12-24 12:48:34.401562
592	1	2026-01-09	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401563	2025-12-24 12:48:34.401563
593	2	2026-01-09	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401563	2025-12-24 12:48:34.401563
594	2	2026-01-09	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401564	2025-12-24 12:48:34.401564
595	2	2026-01-09	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401564	2025-12-24 12:48:34.401565
596	2	2026-01-09	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401565	2025-12-24 12:48:34.401565
597	2	2026-01-09	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401565	2025-12-24 12:48:34.401566
598	2	2026-01-09	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401566	2025-12-24 12:48:34.401566
599	2	2026-01-09	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401567	2025-12-24 12:48:34.401567
600	2	2026-01-09	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401567	2025-12-24 12:48:34.401567
601	2	2026-01-09	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401568	2025-12-24 12:48:34.401568
602	2	2026-01-09	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401568	2025-12-24 12:48:34.401568
603	2	2026-01-09	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401569	2025-12-24 12:48:34.401569
604	2	2026-01-09	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401569	2025-12-24 12:48:34.40157
605	2	2026-01-09	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.40157	2025-12-24 12:48:34.40157
606	2	2026-01-09	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401571	2025-12-24 12:48:34.401571
607	2	2026-01-09	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401571	2025-12-24 12:48:34.401571
608	2	2026-01-09	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401572	2025-12-24 12:48:34.401572
609	3	2026-01-09	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401572	2025-12-24 12:48:34.401572
610	3	2026-01-09	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401573	2025-12-24 12:48:34.401573
611	3	2026-01-09	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401573	2025-12-24 12:48:34.401573
612	3	2026-01-09	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401574	2025-12-24 12:48:34.401574
613	3	2026-01-09	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401574	2025-12-24 12:48:34.401575
614	3	2026-01-09	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401575	2025-12-24 12:48:34.401575
615	3	2026-01-09	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401575	2025-12-24 12:48:34.401576
616	3	2026-01-09	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401576	2025-12-24 12:48:34.401576
617	3	2026-01-09	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401577	2025-12-24 12:48:34.401577
618	3	2026-01-09	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401577	2025-12-24 12:48:34.401577
619	3	2026-01-09	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401578	2025-12-24 12:48:34.401578
620	3	2026-01-09	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401578	2025-12-24 12:48:34.401579
621	3	2026-01-09	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401579	2025-12-24 12:48:34.401579
622	3	2026-01-09	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.40158	2025-12-24 12:48:34.40158
623	3	2026-01-09	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.40158	2025-12-24 12:48:34.40158
624	3	2026-01-09	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401581	2025-12-24 12:48:34.401583
625	1	2026-01-12	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401583	2025-12-24 12:48:34.401584
626	1	2026-01-12	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401584	2025-12-24 12:48:34.401584
627	1	2026-01-12	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401585	2025-12-24 12:48:34.401585
628	1	2026-01-12	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401585	2025-12-24 12:48:34.401585
629	1	2026-01-12	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401586	2025-12-24 12:48:34.401586
630	1	2026-01-12	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401586	2025-12-24 12:48:34.401586
631	1	2026-01-12	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401587	2025-12-24 12:48:34.401587
632	1	2026-01-12	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401587	2025-12-24 12:48:34.401588
633	1	2026-01-12	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401588	2025-12-24 12:48:34.401588
634	1	2026-01-12	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401588	2025-12-24 12:48:34.401589
635	1	2026-01-12	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401589	2025-12-24 12:48:34.401589
636	1	2026-01-12	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.40159	2025-12-24 12:48:34.40159
637	1	2026-01-12	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.40159	2025-12-24 12:48:34.40159
638	1	2026-01-12	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401591	2025-12-24 12:48:34.401591
639	1	2026-01-12	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401591	2025-12-24 12:48:34.401591
640	1	2026-01-12	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401592	2025-12-24 12:48:34.401592
641	2	2026-01-12	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401592	2025-12-24 12:48:34.401592
642	2	2026-01-12	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401593	2025-12-24 12:48:34.401593
643	2	2026-01-12	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401593	2025-12-24 12:48:34.401594
644	2	2026-01-12	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401594	2025-12-24 12:48:34.401594
645	2	2026-01-12	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401594	2025-12-24 12:48:34.401595
646	2	2026-01-12	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401595	2025-12-24 12:48:34.401595
647	2	2026-01-12	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401595	2025-12-24 12:48:34.401596
648	2	2026-01-12	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401596	2025-12-24 12:48:34.401596
649	2	2026-01-12	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401597	2025-12-24 12:48:34.401597
650	2	2026-01-12	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401597	2025-12-24 12:48:34.401597
651	2	2026-01-12	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401598	2025-12-24 12:48:34.401598
652	2	2026-01-12	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401598	2025-12-24 12:48:34.401598
653	2	2026-01-12	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401599	2025-12-24 12:48:34.401599
654	2	2026-01-12	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401599	2025-12-24 12:48:34.4016
655	2	2026-01-12	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.4016	2025-12-24 12:48:34.4016
656	2	2026-01-12	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.4016	2025-12-24 12:48:34.401601
657	3	2026-01-12	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401601	2025-12-24 12:48:34.401601
658	3	2026-01-12	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401602	2025-12-24 12:48:34.401602
659	3	2026-01-12	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401602	2025-12-24 12:48:34.401602
660	3	2026-01-12	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401603	2025-12-24 12:48:34.401603
661	3	2026-01-12	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401603	2025-12-24 12:48:34.401604
662	3	2026-01-12	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401604	2025-12-24 12:48:34.401604
663	3	2026-01-12	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401604	2025-12-24 12:48:34.401605
664	3	2026-01-12	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401605	2025-12-24 12:48:34.401605
665	3	2026-01-12	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401606	2025-12-24 12:48:34.401606
666	3	2026-01-12	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401606	2025-12-24 12:48:34.401608
667	3	2026-01-12	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401608	2025-12-24 12:48:34.401608
668	3	2026-01-12	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401609	2025-12-24 12:48:34.401609
669	3	2026-01-12	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401609	2025-12-24 12:48:34.40161
670	3	2026-01-12	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.40161	2025-12-24 12:48:34.40161
671	3	2026-01-12	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.40161	2025-12-24 12:48:34.401611
672	3	2026-01-12	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401611	2025-12-24 12:48:34.401611
673	1	2026-01-13	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401612	2025-12-24 12:48:34.401612
674	1	2026-01-13	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401612	2025-12-24 12:48:34.401612
675	1	2026-01-13	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401613	2025-12-24 12:48:34.401613
676	1	2026-01-13	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401613	2025-12-24 12:48:34.401614
677	1	2026-01-13	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401614	2025-12-24 12:48:34.401614
678	1	2026-01-13	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401614	2025-12-24 12:48:34.401615
679	1	2026-01-13	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401615	2025-12-24 12:48:34.401615
680	1	2026-01-13	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401616	2025-12-24 12:48:34.401616
681	1	2026-01-13	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401616	2025-12-24 12:48:34.401616
682	1	2026-01-13	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401617	2025-12-24 12:48:34.401617
683	1	2026-01-13	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401617	2025-12-24 12:48:34.401617
684	1	2026-01-13	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401618	2025-12-24 12:48:34.401618
685	1	2026-01-13	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401618	2025-12-24 12:48:34.401619
686	1	2026-01-13	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401619	2025-12-24 12:48:34.401619
687	1	2026-01-13	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401619	2025-12-24 12:48:34.40162
688	1	2026-01-13	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.40162	2025-12-24 12:48:34.40162
689	2	2026-01-13	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401621	2025-12-24 12:48:34.401621
690	2	2026-01-13	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401621	2025-12-24 12:48:34.401621
691	2	2026-01-13	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401622	2025-12-24 12:48:34.401622
692	2	2026-01-13	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401622	2025-12-24 12:48:34.401623
693	2	2026-01-13	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401623	2025-12-24 12:48:34.401623
694	2	2026-01-13	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401623	2025-12-24 12:48:34.401624
695	2	2026-01-13	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401624	2025-12-24 12:48:34.401624
696	2	2026-01-13	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401624	2025-12-24 12:48:34.401625
697	2	2026-01-13	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401625	2025-12-24 12:48:34.401625
698	2	2026-01-13	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401626	2025-12-24 12:48:34.401626
699	2	2026-01-13	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401626	2025-12-24 12:48:34.401626
700	2	2026-01-13	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401627	2025-12-24 12:48:34.401627
701	2	2026-01-13	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401627	2025-12-24 12:48:34.401627
702	2	2026-01-13	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401628	2025-12-24 12:48:34.401628
703	2	2026-01-13	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401628	2025-12-24 12:48:34.401629
704	2	2026-01-13	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401629	2025-12-24 12:48:34.401629
705	3	2026-01-13	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401629	2025-12-24 12:48:34.40163
706	3	2026-01-13	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40163	2025-12-24 12:48:34.40163
707	3	2026-01-13	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40163	2025-12-24 12:48:34.401631
708	3	2026-01-13	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401631	2025-12-24 12:48:34.401631
709	3	2026-01-13	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401633	2025-12-24 12:48:34.401633
710	3	2026-01-13	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401634	2025-12-24 12:48:34.401634
711	3	2026-01-13	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401634	2025-12-24 12:48:34.401634
712	3	2026-01-13	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401635	2025-12-24 12:48:34.401635
713	3	2026-01-13	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401635	2025-12-24 12:48:34.401636
714	3	2026-01-13	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401636	2025-12-24 12:48:34.401636
715	3	2026-01-13	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401636	2025-12-24 12:48:34.401637
716	3	2026-01-13	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401637	2025-12-24 12:48:34.401637
717	3	2026-01-13	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401638	2025-12-24 12:48:34.401638
718	3	2026-01-13	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401638	2025-12-24 12:48:34.401638
719	3	2026-01-13	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401639	2025-12-24 12:48:34.401639
720	3	2026-01-13	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401639	2025-12-24 12:48:34.401639
721	1	2026-01-14	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.40164	2025-12-24 12:48:34.40164
722	1	2026-01-14	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.40164	2025-12-24 12:48:34.401641
723	1	2026-01-14	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401641	2025-12-24 12:48:34.401641
724	1	2026-01-14	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401641	2025-12-24 12:48:34.401642
725	1	2026-01-14	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401642	2025-12-24 12:48:34.401642
726	1	2026-01-14	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401642	2025-12-24 12:48:34.401643
727	1	2026-01-14	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401643	2025-12-24 12:48:34.401643
728	1	2026-01-14	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401644	2025-12-24 12:48:34.401644
729	1	2026-01-14	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401644	2025-12-24 12:48:34.401644
730	1	2026-01-14	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401645	2025-12-24 12:48:34.401645
731	1	2026-01-14	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401645	2025-12-24 12:48:34.401645
732	1	2026-01-14	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401646	2025-12-24 12:48:34.401646
733	1	2026-01-14	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401646	2025-12-24 12:48:34.401647
734	1	2026-01-14	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401647	2025-12-24 12:48:34.401647
735	1	2026-01-14	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401647	2025-12-24 12:48:34.401648
736	1	2026-01-14	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401648	2025-12-24 12:48:34.401648
737	2	2026-01-14	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401648	2025-12-24 12:48:34.401649
738	2	2026-01-14	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401649	2025-12-24 12:48:34.401649
739	2	2026-01-14	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40165	2025-12-24 12:48:34.40165
740	2	2026-01-14	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40165	2025-12-24 12:48:34.40165
741	2	2026-01-14	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401651	2025-12-24 12:48:34.401651
742	2	2026-01-14	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401651	2025-12-24 12:48:34.401652
743	2	2026-01-14	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401652	2025-12-24 12:48:34.401652
744	2	2026-01-14	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401652	2025-12-24 12:48:34.401653
745	2	2026-01-14	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401653	2025-12-24 12:48:34.401653
746	2	2026-01-14	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401654	2025-12-24 12:48:34.401654
747	2	2026-01-14	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401654	2025-12-24 12:48:34.401654
748	2	2026-01-14	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401655	2025-12-24 12:48:34.401655
749	2	2026-01-14	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401655	2025-12-24 12:48:34.401656
750	2	2026-01-14	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401656	2025-12-24 12:48:34.401656
751	2	2026-01-14	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401656	2025-12-24 12:48:34.401658
752	2	2026-01-14	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401658	2025-12-24 12:48:34.401658
753	3	2026-01-14	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401659	2025-12-24 12:48:34.401659
754	3	2026-01-14	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401659	2025-12-24 12:48:34.40166
755	3	2026-01-14	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40166	2025-12-24 12:48:34.40166
756	3	2026-01-14	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401661	2025-12-24 12:48:34.401661
757	3	2026-01-14	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401661	2025-12-24 12:48:34.401661
758	3	2026-01-14	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401662	2025-12-24 12:48:34.401662
759	3	2026-01-14	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401662	2025-12-24 12:48:34.401663
760	3	2026-01-14	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401663	2025-12-24 12:48:34.401663
761	3	2026-01-14	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401664	2025-12-24 12:48:34.401664
762	3	2026-01-14	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401664	2025-12-24 12:48:34.401664
763	3	2026-01-14	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401665	2025-12-24 12:48:34.401665
764	3	2026-01-14	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401665	2025-12-24 12:48:34.401665
765	3	2026-01-14	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401666	2025-12-24 12:48:34.401666
766	3	2026-01-14	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401666	2025-12-24 12:48:34.401667
767	3	2026-01-14	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401667	2025-12-24 12:48:34.401667
768	3	2026-01-14	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401667	2025-12-24 12:48:34.401668
769	1	2026-01-15	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401668	2025-12-24 12:48:34.401668
770	1	2026-01-15	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401668	2025-12-24 12:48:34.401669
771	1	2026-01-15	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401669	2025-12-24 12:48:34.401669
772	1	2026-01-15	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40167	2025-12-24 12:48:34.40167
773	1	2026-01-15	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.40167	2025-12-24 12:48:34.40167
774	1	2026-01-15	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401671	2025-12-24 12:48:34.401671
775	1	2026-01-15	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401671	2025-12-24 12:48:34.401671
776	1	2026-01-15	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401672	2025-12-24 12:48:34.401672
777	1	2026-01-15	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401672	2025-12-24 12:48:34.401672
778	1	2026-01-15	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401673	2025-12-24 12:48:34.401673
779	1	2026-01-15	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401673	2025-12-24 12:48:34.401674
780	1	2026-01-15	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401674	2025-12-24 12:48:34.401674
781	1	2026-01-15	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401674	2025-12-24 12:48:34.401675
782	1	2026-01-15	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401675	2025-12-24 12:48:34.401675
783	1	2026-01-15	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401675	2025-12-24 12:48:34.401676
784	1	2026-01-15	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401676	2025-12-24 12:48:34.401676
785	2	2026-01-15	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401677	2025-12-24 12:48:34.401677
786	2	2026-01-15	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401677	2025-12-24 12:48:34.401677
787	2	2026-01-15	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401678	2025-12-24 12:48:34.401678
788	2	2026-01-15	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401678	2025-12-24 12:48:34.401678
789	2	2026-01-15	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401679	2025-12-24 12:48:34.401679
790	2	2026-01-15	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401679	2025-12-24 12:48:34.40168
791	2	2026-01-15	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.40168	2025-12-24 12:48:34.40168
792	2	2026-01-15	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40168	2025-12-24 12:48:34.401681
793	2	2026-01-15	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401681	2025-12-24 12:48:34.401681
794	2	2026-01-15	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401681	2025-12-24 12:48:34.401683
795	2	2026-01-15	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401683	2025-12-24 12:48:34.401684
796	2	2026-01-15	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401684	2025-12-24 12:48:34.401684
797	2	2026-01-15	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401685	2025-12-24 12:48:34.401685
798	2	2026-01-15	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401685	2025-12-24 12:48:34.401685
799	2	2026-01-15	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401686	2025-12-24 12:48:34.401686
800	2	2026-01-15	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401686	2025-12-24 12:48:34.401686
801	3	2026-01-15	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401687	2025-12-24 12:48:34.401687
802	3	2026-01-15	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401687	2025-12-24 12:48:34.401687
803	3	2026-01-15	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401688	2025-12-24 12:48:34.401688
804	3	2026-01-15	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401688	2025-12-24 12:48:34.401688
805	3	2026-01-15	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401689	2025-12-24 12:48:34.401689
806	3	2026-01-15	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401689	2025-12-24 12:48:34.40169
807	3	2026-01-15	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.40169	2025-12-24 12:48:34.40169
808	3	2026-01-15	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401691	2025-12-24 12:48:34.401691
809	3	2026-01-15	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401691	2025-12-24 12:48:34.401691
810	3	2026-01-15	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401692	2025-12-24 12:48:34.401692
811	3	2026-01-15	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401692	2025-12-24 12:48:34.401693
812	3	2026-01-15	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401693	2025-12-24 12:48:34.401693
813	3	2026-01-15	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401693	2025-12-24 12:48:34.401694
814	3	2026-01-15	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401694	2025-12-24 12:48:34.401694
815	3	2026-01-15	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401694	2025-12-24 12:48:34.401695
816	3	2026-01-15	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401695	2025-12-24 12:48:34.401695
817	1	2026-01-16	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401696	2025-12-24 12:48:34.401696
818	1	2026-01-16	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401696	2025-12-24 12:48:34.401696
819	1	2026-01-16	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401697	2025-12-24 12:48:34.401697
820	1	2026-01-16	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401697	2025-12-24 12:48:34.401697
821	1	2026-01-16	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401698	2025-12-24 12:48:34.401698
822	1	2026-01-16	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401698	2025-12-24 12:48:34.401699
823	1	2026-01-16	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401699	2025-12-24 12:48:34.401699
824	1	2026-01-16	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.4017	2025-12-24 12:48:34.4017
825	1	2026-01-16	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.4017	2025-12-24 12:48:34.4017
826	1	2026-01-16	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401701	2025-12-24 12:48:34.401701
827	1	2026-01-16	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401701	2025-12-24 12:48:34.401702
828	1	2026-01-16	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401702	2025-12-24 12:48:34.401702
829	1	2026-01-16	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401702	2025-12-24 12:48:34.401703
830	1	2026-01-16	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401703	2025-12-24 12:48:34.401703
831	1	2026-01-16	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401704	2025-12-24 12:48:34.401704
832	1	2026-01-16	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401704	2025-12-24 12:48:34.401704
833	2	2026-01-16	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401705	2025-12-24 12:48:34.401705
834	2	2026-01-16	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401705	2025-12-24 12:48:34.401706
835	2	2026-01-16	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401706	2025-12-24 12:48:34.401706
836	2	2026-01-16	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401706	2025-12-24 12:48:34.401708
837	2	2026-01-16	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401708	2025-12-24 12:48:34.401709
838	2	2026-01-16	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401709	2025-12-24 12:48:34.401709
839	2	2026-01-16	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401709	2025-12-24 12:48:34.40171
840	2	2026-01-16	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40171	2025-12-24 12:48:34.40171
841	2	2026-01-16	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.40171	2025-12-24 12:48:34.401711
842	2	2026-01-16	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401711	2025-12-24 12:48:34.401711
843	2	2026-01-16	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401712	2025-12-24 12:48:34.401712
844	2	2026-01-16	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401712	2025-12-24 12:48:34.401712
845	2	2026-01-16	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401713	2025-12-24 12:48:34.401713
846	2	2026-01-16	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401713	2025-12-24 12:48:34.401714
847	2	2026-01-16	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401714	2025-12-24 12:48:34.401714
848	2	2026-01-16	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401714	2025-12-24 12:48:34.401715
849	3	2026-01-16	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401715	2025-12-24 12:48:34.401715
850	3	2026-01-16	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401715	2025-12-24 12:48:34.401716
851	3	2026-01-16	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401716	2025-12-24 12:48:34.401716
852	3	2026-01-16	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401717	2025-12-24 12:48:34.401717
853	3	2026-01-16	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401717	2025-12-24 12:48:34.401717
854	3	2026-01-16	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401718	2025-12-24 12:48:34.401718
855	3	2026-01-16	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401718	2025-12-24 12:48:34.401719
856	3	2026-01-16	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401719	2025-12-24 12:48:34.401719
857	3	2026-01-16	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401719	2025-12-24 12:48:34.40172
858	3	2026-01-16	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40172	2025-12-24 12:48:34.40172
859	3	2026-01-16	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401721	2025-12-24 12:48:34.401721
860	3	2026-01-16	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401721	2025-12-24 12:48:34.401721
861	3	2026-01-16	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401722	2025-12-24 12:48:34.401722
862	3	2026-01-16	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401722	2025-12-24 12:48:34.401722
863	3	2026-01-16	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401723	2025-12-24 12:48:34.401723
864	3	2026-01-16	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401723	2025-12-24 12:48:34.401724
865	1	2026-01-19	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401724	2025-12-24 12:48:34.401724
866	1	2026-01-19	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401724	2025-12-24 12:48:34.401725
867	1	2026-01-19	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401725	2025-12-24 12:48:34.401725
868	1	2026-01-19	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401726	2025-12-24 12:48:34.401726
869	1	2026-01-19	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401726	2025-12-24 12:48:34.401726
870	1	2026-01-19	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401727	2025-12-24 12:48:34.401727
871	1	2026-01-19	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401727	2025-12-24 12:48:34.401728
872	1	2026-01-19	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401728	2025-12-24 12:48:34.401728
873	1	2026-01-19	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401728	2025-12-24 12:48:34.401729
874	1	2026-01-19	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401729	2025-12-24 12:48:34.401729
875	1	2026-01-19	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401729	2025-12-24 12:48:34.40173
876	1	2026-01-19	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.40173	2025-12-24 12:48:34.40173
877	1	2026-01-19	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401731	2025-12-24 12:48:34.401731
878	1	2026-01-19	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401731	2025-12-24 12:48:34.401731
879	1	2026-01-19	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401733	2025-12-24 12:48:34.401733
880	1	2026-01-19	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401734	2025-12-24 12:48:34.401734
881	2	2026-01-19	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401734	2025-12-24 12:48:34.401735
882	2	2026-01-19	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401735	2025-12-24 12:48:34.401735
883	2	2026-01-19	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401736	2025-12-24 12:48:34.401736
884	2	2026-01-19	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401736	2025-12-24 12:48:34.401737
885	2	2026-01-19	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401737	2025-12-24 12:48:34.401737
886	2	2026-01-19	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401738	2025-12-24 12:48:34.401738
887	2	2026-01-19	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401738	2025-12-24 12:48:34.401738
888	2	2026-01-19	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401739	2025-12-24 12:48:34.401739
889	2	2026-01-19	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401739	2025-12-24 12:48:34.401739
890	2	2026-01-19	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.40174	2025-12-24 12:48:34.40174
891	2	2026-01-19	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.40174	2025-12-24 12:48:34.401741
892	2	2026-01-19	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401741	2025-12-24 12:48:34.401741
893	2	2026-01-19	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401742	2025-12-24 12:48:34.401742
894	2	2026-01-19	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401742	2025-12-24 12:48:34.401742
895	2	2026-01-19	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401743	2025-12-24 12:48:34.401743
896	2	2026-01-19	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401743	2025-12-24 12:48:34.401744
897	3	2026-01-19	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401744	2025-12-24 12:48:34.401744
898	3	2026-01-19	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401744	2025-12-24 12:48:34.401745
899	3	2026-01-19	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401745	2025-12-24 12:48:34.401745
900	3	2026-01-19	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401746	2025-12-24 12:48:34.401746
901	3	2026-01-19	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401746	2025-12-24 12:48:34.401746
902	3	2026-01-19	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401747	2025-12-24 12:48:34.401747
903	3	2026-01-19	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401747	2025-12-24 12:48:34.401748
904	3	2026-01-19	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401748	2025-12-24 12:48:34.401748
905	3	2026-01-19	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401748	2025-12-24 12:48:34.401749
906	3	2026-01-19	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401749	2025-12-24 12:48:34.401749
907	3	2026-01-19	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401749	2025-12-24 12:48:34.40175
908	3	2026-01-19	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.40175	2025-12-24 12:48:34.40175
909	3	2026-01-19	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401751	2025-12-24 12:48:34.401751
910	3	2026-01-19	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401751	2025-12-24 12:48:34.401751
911	3	2026-01-19	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401752	2025-12-24 12:48:34.401752
912	3	2026-01-19	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401752	2025-12-24 12:48:34.401752
913	1	2026-01-20	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401753	2025-12-24 12:48:34.401753
914	1	2026-01-20	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401753	2025-12-24 12:48:34.401754
915	1	2026-01-20	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401754	2025-12-24 12:48:34.401754
916	1	2026-01-20	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401754	2025-12-24 12:48:34.401755
917	1	2026-01-20	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401755	2025-12-24 12:48:34.401755
918	1	2026-01-20	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401755	2025-12-24 12:48:34.401756
919	1	2026-01-20	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401756	2025-12-24 12:48:34.401756
920	1	2026-01-20	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401757	2025-12-24 12:48:34.401757
921	1	2026-01-20	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401757	2025-12-24 12:48:34.401789
922	1	2026-01-20	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401791	2025-12-24 12:48:34.401792
923	1	2026-01-20	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401792	2025-12-24 12:48:34.401793
924	1	2026-01-20	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401794	2025-12-24 12:48:34.401794
925	1	2026-01-20	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401795	2025-12-24 12:48:34.401795
926	1	2026-01-20	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401795	2025-12-24 12:48:34.401795
927	1	2026-01-20	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401796	2025-12-24 12:48:34.401796
928	1	2026-01-20	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401796	2025-12-24 12:48:34.401797
929	2	2026-01-20	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401797	2025-12-24 12:48:34.401797
930	2	2026-01-20	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401797	2025-12-24 12:48:34.401798
931	2	2026-01-20	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401798	2025-12-24 12:48:34.401798
932	2	2026-01-20	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401799	2025-12-24 12:48:34.401799
933	2	2026-01-20	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401799	2025-12-24 12:48:34.401799
934	2	2026-01-20	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.4018	2025-12-24 12:48:34.4018
935	2	2026-01-20	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.4018	2025-12-24 12:48:34.401801
936	2	2026-01-20	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401801	2025-12-24 12:48:34.401801
937	2	2026-01-20	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401801	2025-12-24 12:48:34.401802
938	2	2026-01-20	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401802	2025-12-24 12:48:34.401802
939	2	2026-01-20	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401802	2025-12-24 12:48:34.401803
940	2	2026-01-20	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401803	2025-12-24 12:48:34.401803
941	2	2026-01-20	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401804	2025-12-24 12:48:34.401804
942	2	2026-01-20	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401804	2025-12-24 12:48:34.401804
943	2	2026-01-20	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401805	2025-12-24 12:48:34.401805
944	2	2026-01-20	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401805	2025-12-24 12:48:34.401806
945	3	2026-01-20	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401806	2025-12-24 12:48:34.401806
946	3	2026-01-20	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401807	2025-12-24 12:48:34.401807
947	3	2026-01-20	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401807	2025-12-24 12:48:34.401807
948	3	2026-01-20	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401808	2025-12-24 12:48:34.401808
949	3	2026-01-20	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401808	2025-12-24 12:48:34.401809
950	3	2026-01-20	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401809	2025-12-24 12:48:34.401809
951	3	2026-01-20	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401809	2025-12-24 12:48:34.40181
952	3	2026-01-20	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.40181	2025-12-24 12:48:34.40181
953	3	2026-01-20	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401811	2025-12-24 12:48:34.401811
954	3	2026-01-20	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401811	2025-12-24 12:48:34.401811
955	3	2026-01-20	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401812	2025-12-24 12:48:34.401812
956	3	2026-01-20	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401812	2025-12-24 12:48:34.401813
957	3	2026-01-20	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401813	2025-12-24 12:48:34.401813
958	3	2026-01-20	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401813	2025-12-24 12:48:34.401814
959	3	2026-01-20	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401814	2025-12-24 12:48:34.401814
960	3	2026-01-20	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401815	2025-12-24 12:48:34.401815
961	1	2026-01-21	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401815	2025-12-24 12:48:34.401816
962	1	2026-01-21	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401816	2025-12-24 12:48:34.401816
963	1	2026-01-21	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401817	2025-12-24 12:48:34.401817
964	1	2026-01-21	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401817	2025-12-24 12:48:34.401821
965	1	2026-01-21	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401822	2025-12-24 12:48:34.401822
966	1	2026-01-21	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401822	2025-12-24 12:48:34.401823
967	1	2026-01-21	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401823	2025-12-24 12:48:34.401823
968	1	2026-01-21	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401823	2025-12-24 12:48:34.401824
969	1	2026-01-21	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401824	2025-12-24 12:48:34.401824
970	1	2026-01-21	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401825	2025-12-24 12:48:34.401825
971	1	2026-01-21	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401825	2025-12-24 12:48:34.401825
972	1	2026-01-21	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401826	2025-12-24 12:48:34.401826
973	1	2026-01-21	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401826	2025-12-24 12:48:34.401827
974	1	2026-01-21	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401827	2025-12-24 12:48:34.401827
975	1	2026-01-21	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401827	2025-12-24 12:48:34.401828
976	1	2026-01-21	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401828	2025-12-24 12:48:34.401828
977	2	2026-01-21	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401829	2025-12-24 12:48:34.401829
978	2	2026-01-21	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401829	2025-12-24 12:48:34.401829
979	2	2026-01-21	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.40183	2025-12-24 12:48:34.40183
980	2	2026-01-21	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.40183	2025-12-24 12:48:34.40183
981	2	2026-01-21	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401831	2025-12-24 12:48:34.401831
982	2	2026-01-21	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.401831	2025-12-24 12:48:34.401831
983	2	2026-01-21	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401832	2025-12-24 12:48:34.401832
984	2	2026-01-21	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401832	2025-12-24 12:48:34.401833
985	2	2026-01-21	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401833	2025-12-24 12:48:34.401833
986	2	2026-01-21	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401833	2025-12-24 12:48:34.401834
987	2	2026-01-21	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401834	2025-12-24 12:48:34.401834
988	2	2026-01-21	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401835	2025-12-24 12:48:34.401835
989	2	2026-01-21	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401835	2025-12-24 12:48:34.401835
990	2	2026-01-21	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401836	2025-12-24 12:48:34.401836
991	2	2026-01-21	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401836	2025-12-24 12:48:34.401836
992	2	2026-01-21	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401837	2025-12-24 12:48:34.401837
993	3	2026-01-21	09:00:00	09:30:00	2	t	2025-12-24 12:48:34.401837	2025-12-24 12:48:34.401838
994	3	2026-01-21	09:30:00	10:00:00	2	t	2025-12-24 12:48:34.401838	2025-12-24 12:48:34.401838
995	3	2026-01-21	10:00:00	10:30:00	2	t	2025-12-24 12:48:34.401838	2025-12-24 12:48:34.401839
996	3	2026-01-21	10:30:00	11:00:00	2	t	2025-12-24 12:48:34.401839	2025-12-24 12:48:34.401839
997	3	2026-01-21	11:00:00	11:30:00	2	t	2025-12-24 12:48:34.401839	2025-12-24 12:48:34.40184
998	3	2026-01-21	11:30:00	12:00:00	2	t	2025-12-24 12:48:34.40184	2025-12-24 12:48:34.40184
999	3	2026-01-21	12:00:00	12:30:00	2	t	2025-12-24 12:48:34.401841	2025-12-24 12:48:34.401841
1000	3	2026-01-21	12:30:00	13:00:00	2	t	2025-12-24 12:48:34.401841	2025-12-24 12:48:34.401841
1001	3	2026-01-21	14:00:00	14:30:00	2	t	2025-12-24 12:48:34.401842	2025-12-24 12:48:34.401842
1002	3	2026-01-21	14:30:00	15:00:00	2	t	2025-12-24 12:48:34.401842	2025-12-24 12:48:34.401843
1003	3	2026-01-21	15:00:00	15:30:00	2	t	2025-12-24 12:48:34.401843	2025-12-24 12:48:34.401843
1004	3	2026-01-21	15:30:00	16:00:00	2	t	2025-12-24 12:48:34.401843	2025-12-24 12:48:34.401844
1005	3	2026-01-21	16:00:00	16:30:00	2	t	2025-12-24 12:48:34.401844	2025-12-24 12:48:34.401844
1006	3	2026-01-21	16:30:00	17:00:00	2	t	2025-12-24 12:48:34.401844	2025-12-24 12:48:34.401846
1007	3	2026-01-21	17:00:00	17:30:00	2	t	2025-12-24 12:48:34.401846	2025-12-24 12:48:34.401847
1008	3	2026-01-21	17:30:00	18:00:00	2	t	2025-12-24 12:48:34.401847	2025-12-24 12:48:34.401847
\.


--
-- Data for Name: transport_types; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.transport_types (id, name, enum_value) FROM stdin;
1	собственное производство	own_production
2	закупная	purchased
3	контейнер	container
4	возврат	return_goods
\.


--
-- Data for Name: user_supplier_relations; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.user_supplier_relations (id, user_id, supplier_id) FROM stdin;
\.


--
-- Data for Name: user_suppliers; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.user_suppliers (user_id, supplier_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.users (id, email, full_name, password_hash, role, is_active, created_at) FROM stdin;
1	admin@yms.local	YMS Admin	$pbkdf2-sha256$29000$IoRwjhECgHAuBSDkfG.NUQ$IDd.n.eolSRdPwnzGs5MQF.ylhc8f8xqgSdYGBDYzAE	admin	t	2025-12-24 12:48:34.277209
\.


--
-- Data for Name: vehicle_types; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.vehicle_types (id, name, duration_minutes) FROM stdin;
1	Фура 20т	120
2	Газель	60
3	Цистерна	90
\.


--
-- Data for Name: work_schedules; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.work_schedules (id, day_of_week, dock_id, work_start, work_end, break_start, break_end, is_working_day, capacity) FROM stdin;
1	0	1	09:00:00	18:00:00	13:00:00	14:00:00	t	2
2	1	1	09:00:00	18:00:00	13:00:00	14:00:00	t	2
3	2	1	09:00:00	18:00:00	13:00:00	14:00:00	t	2
4	3	1	09:00:00	18:00:00	13:00:00	14:00:00	t	2
5	4	1	09:00:00	18:00:00	13:00:00	14:00:00	t	2
6	5	1	\N	\N	\N	\N	f	0
7	6	1	\N	\N	\N	\N	f	0
8	0	2	09:00:00	18:00:00	13:00:00	14:00:00	t	2
9	1	2	09:00:00	18:00:00	13:00:00	14:00:00	t	2
10	2	2	09:00:00	18:00:00	13:00:00	14:00:00	t	2
11	3	2	09:00:00	18:00:00	13:00:00	14:00:00	t	2
12	4	2	09:00:00	18:00:00	13:00:00	14:00:00	t	2
13	5	2	\N	\N	\N	\N	f	0
14	6	2	\N	\N	\N	\N	f	0
15	0	3	09:00:00	18:00:00	13:00:00	14:00:00	t	2
16	1	3	09:00:00	18:00:00	13:00:00	14:00:00	t	2
17	2	3	09:00:00	18:00:00	13:00:00	14:00:00	t	2
18	3	3	09:00:00	18:00:00	13:00:00	14:00:00	t	2
19	4	3	09:00:00	18:00:00	13:00:00	14:00:00	t	2
20	5	3	\N	\N	\N	\N	f	0
21	6	3	\N	\N	\N	\N	f	0
\.


--
-- Data for Name: zones; Type: TABLE DATA; Schema: public; Owner: yms
--

COPY public.zones (id, name) FROM stdin;
1	Эрго/решетки/корпус
2	Кровати/Диваны
3	Аксессуары/матрасы
4	Закупка Импорт
\.


--
-- Name: booking_time_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.booking_time_slots_id_seq', 1, false);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.bookings_id_seq', 1, false);


--
-- Name: docks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.docks_id_seq', 3, true);


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.objects_id_seq', 2, true);


--
-- Name: prr_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.prr_limits_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 5, true);


--
-- Name: time_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.time_slots_id_seq', 1008, true);


--
-- Name: transport_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.transport_types_id_seq', 4, true);


--
-- Name: user_supplier_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.user_supplier_relations_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: vehicle_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.vehicle_types_id_seq', 3, true);


--
-- Name: work_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.work_schedules_id_seq', 21, true);


--
-- Name: zones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yms
--

SELECT pg_catalog.setval('public.zones_id_seq', 4, true);


--
-- Name: prr_limits _object_supplier_transport_vehicle_uc; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT _object_supplier_transport_vehicle_uc UNIQUE (object_id, supplier_id, transport_type_id, vehicle_type_id);


--
-- Name: booking_time_slots booking_time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.booking_time_slots
    ADD CONSTRAINT booking_time_slots_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: dock_transport_type_association dock_transport_type_association_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_transport_type_association
    ADD CONSTRAINT dock_transport_type_association_pkey PRIMARY KEY (dock_id, transport_type_id);


--
-- Name: dock_zone_association dock_zone_association_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_zone_association
    ADD CONSTRAINT dock_zone_association_pkey PRIMARY KEY (dock_id, zone_id);


--
-- Name: docks docks_name_key; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.docks
    ADD CONSTRAINT docks_name_key UNIQUE (name);


--
-- Name: docks docks_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.docks
    ADD CONSTRAINT docks_pkey PRIMARY KEY (id);


--
-- Name: objects objects_name_key; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT objects_name_key UNIQUE (name);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prr_limits prr_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT prr_limits_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: time_slots time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT time_slots_pkey PRIMARY KEY (id);


--
-- Name: transport_types transport_types_name_key; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.transport_types
    ADD CONSTRAINT transport_types_name_key UNIQUE (name);


--
-- Name: transport_types transport_types_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.transport_types
    ADD CONSTRAINT transport_types_pkey PRIMARY KEY (id);


--
-- Name: booking_time_slots uq_booking_time_slot; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.booking_time_slots
    ADD CONSTRAINT uq_booking_time_slot UNIQUE (booking_id, time_slot_id);


--
-- Name: time_slots uq_time_slots_unique; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT uq_time_slots_unique UNIQUE (dock_id, slot_date, start_time, end_time);


--
-- Name: user_supplier_relations uq_user_supplier; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_supplier_relations
    ADD CONSTRAINT uq_user_supplier UNIQUE (user_id, supplier_id);


--
-- Name: work_schedules uq_work_schedules_day_dock; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.work_schedules
    ADD CONSTRAINT uq_work_schedules_day_dock UNIQUE (day_of_week, dock_id);


--
-- Name: user_supplier_relations user_supplier_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_supplier_relations
    ADD CONSTRAINT user_supplier_relations_pkey PRIMARY KEY (id);


--
-- Name: user_suppliers user_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_suppliers
    ADD CONSTRAINT user_suppliers_pkey PRIMARY KEY (user_id, supplier_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_types vehicle_types_name_key; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_name_key UNIQUE (name);


--
-- Name: vehicle_types vehicle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_pkey PRIMARY KEY (id);


--
-- Name: work_schedules work_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.work_schedules
    ADD CONSTRAINT work_schedules_pkey PRIMARY KEY (id);


--
-- Name: zones zones_name_key; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_name_key UNIQUE (name);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: ix_docks_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_docks_id ON public.docks USING btree (id);


--
-- Name: ix_objects_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_objects_id ON public.objects USING btree (id);


--
-- Name: ix_suppliers_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_suppliers_id ON public.suppliers USING btree (id);


--
-- Name: ix_transport_types_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_transport_types_id ON public.transport_types USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: yms
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_vehicle_types_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_vehicle_types_id ON public.vehicle_types USING btree (id);


--
-- Name: ix_zones_id; Type: INDEX; Schema: public; Owner: yms
--

CREATE INDEX ix_zones_id ON public.zones USING btree (id);


--
-- Name: booking_time_slots booking_time_slots_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.booking_time_slots
    ADD CONSTRAINT booking_time_slots_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_time_slots booking_time_slots_time_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.booking_time_slots
    ADD CONSTRAINT booking_time_slots_time_slot_id_fkey FOREIGN KEY (time_slot_id) REFERENCES public.time_slots(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: bookings bookings_transport_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_transport_type_id_fkey FOREIGN KEY (transport_type_id) REFERENCES public.transport_types(id);


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bookings bookings_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id);


--
-- Name: bookings bookings_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: dock_transport_type_association dock_transport_type_association_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_transport_type_association
    ADD CONSTRAINT dock_transport_type_association_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.docks(id) ON DELETE CASCADE;


--
-- Name: dock_transport_type_association dock_transport_type_association_transport_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_transport_type_association
    ADD CONSTRAINT dock_transport_type_association_transport_type_id_fkey FOREIGN KEY (transport_type_id) REFERENCES public.transport_types(id) ON DELETE CASCADE;


--
-- Name: dock_zone_association dock_zone_association_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_zone_association
    ADD CONSTRAINT dock_zone_association_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.docks(id) ON DELETE CASCADE;


--
-- Name: dock_zone_association dock_zone_association_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.dock_zone_association
    ADD CONSTRAINT dock_zone_association_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: docks docks_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.docks
    ADD CONSTRAINT docks_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.objects(id);


--
-- Name: prr_limits prr_limits_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT prr_limits_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.objects(id);


--
-- Name: prr_limits prr_limits_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT prr_limits_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: prr_limits prr_limits_transport_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT prr_limits_transport_type_id_fkey FOREIGN KEY (transport_type_id) REFERENCES public.transport_types(id);


--
-- Name: prr_limits prr_limits_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.prr_limits
    ADD CONSTRAINT prr_limits_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id);


--
-- Name: suppliers suppliers_transport_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_transport_type_id_fkey FOREIGN KEY (transport_type_id) REFERENCES public.transport_types(id);


--
-- Name: suppliers suppliers_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: time_slots time_slots_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT time_slots_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.docks(id);


--
-- Name: user_supplier_relations user_supplier_relations_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_supplier_relations
    ADD CONSTRAINT user_supplier_relations_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: user_supplier_relations user_supplier_relations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_supplier_relations
    ADD CONSTRAINT user_supplier_relations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_suppliers user_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_suppliers
    ADD CONSTRAINT user_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: user_suppliers user_suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.user_suppliers
    ADD CONSTRAINT user_suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: work_schedules work_schedules_dock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yms
--

ALTER TABLE ONLY public.work_schedules
    ADD CONSTRAINT work_schedules_dock_id_fkey FOREIGN KEY (dock_id) REFERENCES public.docks(id);


--
-- PostgreSQL database dump complete
--

\unrestrict EKfSufLdp2WgQpxIcW2mU5JpohePFCFOZtDilm3diEHkOpwOYqXjXAV0W2gUWuu

