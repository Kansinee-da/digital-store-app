create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null,
  price numeric not null, description text,
  file_path text, created_at timestamptz default now()
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  product_id uuid references products not null,
  amount numeric not null, created_at timestamptz default now()
);
alter table products enable row level security;
alter table orders enable row level security;
create policy "ทุกคนดูสินค้าได้" on products for select using (true);
create policy "ดูได้เฉพาะออเดอร์ตัวเอง" on orders for select using (auth.uid() = user_id);
insert into products (name, category, price, description, file_path) values
 ('Notion Template','เทมเพลต',299,'ชุดเทมเพลตจัดการงานและโปรเจกต์','notion-template.zip'),
 ('UI Icon Pack','ดีไซน์',399,'ไอคอนเส้นบาง 500 ชิ้น','ui-icon-pack.zip');
