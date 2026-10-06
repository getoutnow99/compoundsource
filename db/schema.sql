-- CompoundSource database schema. Safe to run more than once.

create table if not exists clinics (
  id                serial primary key,
  name              text not null,
  street            text not null,
  city              text not null,
  state             text not null,
  zip               text not null,
  phone             text not null,
  email             text not null,
  fax               text,
  website           text,
  office_hours      text,
  emr_system        text,
  ship_method       text not null check (ship_method in ('patient','office')),
  ship_street       text,
  ship_city         text,
  ship_state        text,
  ship_zip          text,
  delivery_day      text check (delivery_day in ('Tue','Wed','Thu','Fri')),
  contact_name      text not null,
  contact_phone     text not null,
  contact_email     text not null,
  payment_method    text not null check (payment_method in ('card','invoice')),
  billing_name      text not null,
  billing_street    text not null,
  billing_city      text not null,
  billing_state     text not null,
  billing_zip       text not null,
  billing_email     text not null,
  agreement_name    text not null,
  agreement_title   text,
  agreement_signed_at timestamptz not null,
  agreement_ip      text,
  status            text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes       text,
  created_at        timestamptz not null default now()
);

create table if not exists prescribers (
  id            serial primary key,
  clinic_id     int not null references clinics(id) on delete cascade,
  full_name     text not null,
  title         text not null,
  state_license text not null,
  license_state text not null,
  dea           text,
  npi           text not null
);

create table if not exists clinic_documents (
  id         serial primary key,
  clinic_id  int not null references clinics(id) on delete cascade,
  kind       text not null,
  filename   text not null,
  mime       text not null,
  data       bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id            serial primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  role          text not null check (role in ('clinic','admin')),
  clinic_id     int references clinics(id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists sessions (
  token_hash  text primary key,
  user_id     int not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  expires_at  timestamptz not null
);

create table if not exists pharmacies (
  id        text primary key,
  name      text not null,
  location  text,
  price_list text
);

create table if not exists medications (
  id        serial primary key,
  name      text not null,
  category  text not null,
  unit      text not null,
  flags     text[] not null default '{}',
  note      text,
  source    text,
  active    boolean not null default true,
  unique (name, unit)
);

create table if not exists medication_prices (
  medication_id int not null references medications(id) on delete cascade,
  pharmacy_id   text not null references pharmacies(id),
  price         numeric(10,2) not null,
  primary key (medication_id, pharmacy_id)
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id              serial primary key,
  number          text not null unique default ('CS-' || nextval('order_number_seq')),
  clinic_id       int not null references clinics(id),
  created_by      int not null references users(id),
  prescriber_id   int references prescribers(id),
  status          text not null default 'submitted' check (status in ('submitted','sent','shipped','delivered','cancelled')),
  patient_first   text not null,
  patient_last    text not null,
  patient_dob     date not null,
  patient_street  text not null,
  patient_city    text not null,
  patient_state   text not null,
  patient_zip     text not null,
  patient_phone   text,
  patient_allergies text,
  ship_to         text not null check (ship_to in ('patient','clinic')),
  notes           text,
  tracking        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists order_items (
  id            serial primary key,
  order_id      int not null references orders(id) on delete cascade,
  medication_id int not null references medications(id),
  qty           int not null check (qty > 0),
  pharmacy_id   text references pharmacies(id),
  unit_price    numeric(10,2)
);

create table if not exists order_files (
  id         serial primary key,
  order_id   int not null references orders(id) on delete cascade,
  filename   text not null,
  mime       text not null,
  data       bytea not null,
  created_at timestamptz not null default now()
);

-- Who looked at or changed patient and clinic records, as HIPAA expects.
create table if not exists audit_log (
  id        bigserial primary key,
  user_id   int references users(id),
  action    text not null,
  entity    text not null,
  entity_id text,
  ip        text,
  at        timestamptz not null default now()
);

create index if not exists orders_clinic_idx on orders (clinic_id, created_at desc);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists audit_entity_idx on audit_log (entity, entity_id);
