-- Shared PostgreSQL extensions and enums.
create extension if not exists pgcrypto;

create type public.app_role as enum (
  'admin',
  'pastor',
  'elder',
  'treasurer',
  'secretary',
  'department_head',
  'member'
);

create type public.member_status as enum (
  'active',
  'inactive',
  'transferred',
  'deceased'
);

create type public.attendance_status as enum (
  'present',
  'absent',
  'visitor'
);

create type public.contribution_type as enum (
  'tithe',
  'offering',
  'building_fund',
  'missions',
  'welfare',
  'other'
);

create type public.payment_method as enum (
  'cash',
  'bank_transfer',
  'card',
  'mobile_money',
  'other'
);

create type public.event_status as enum (
  'draft',
  'published',
  'cancelled',
  'completed'
);

create type public.announcement_status as enum (
  'draft',
  'published',
  'archived'
);
