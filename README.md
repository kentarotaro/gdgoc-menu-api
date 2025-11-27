#  Smart Menu Catalog API

Backend REST API canggih untuk manajemen menu restoran, dibangun dengan **Node.js (Express)** dan **Supabase (PostgreSQL)**. 

Project ini mengintegrasikan **Google Gemini AI** untuk otomatisasi cerdas (Auto-description, Calorie Estimation, & Price Suggestion).

##  Live Demo & Documentation

* **Base URL (Deployment):** [https://gdgoc-menu-api.vercel.app](https://gdgoc-menu-api.vercel.app)
* **API Documentation (Postman):** [KLIK DI SINI UNTUK MELIHAT DOKUMENTASI LENGKAP](https://documenter.getpostman.com/view/50299653/2sB3dK1D2m) 

##  Fitur Unggulan (Key Features)

### 1. AI-Powered Automation (Gemini)
* **Auto-Description:** Otomatis membuat deskripsi menu yang menggugah selera jika user tidak mengisinya.
* **Nutrition Analyst:** Mengestimasi kalori berdasarkan nama menu dan bahan.
* **Smart Pricing:** Memberikan rekomendasi harga jual berdasarkan analisis HPP bahan baku.
* **Sanity Check:** Sistem proteksi untuk menolak input tidak masuk akal (misal: "Tumis Batu") agar database tetap bersih.

### 2. Security & Reliability
* **Custom Rate Limiter:** Mencegah spamming pada endpoint AI.
* **Data Sanitization:** Memastikan output API selalu konsisten (tidak ada nilai null yang merusak Frontend).
* **Persistent Database:** Menggunakan PostgreSQL (Supabase), bukan array sementara.

### 3. Architecture
* **MVC Pattern:** Kode terstruktur rapi (Models, Views, Controllers).
* **Advanced Querying:** Mendukung Search, Filtering, Sorting, dan Pagination.

## Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** Supabase (PostgreSQL)
* **AI:** Google Gemini 1.5 Flash
* **Deployment:** Vercel

##  Cara Menjalankan di Lokal

1.  **Clone Repository**
    ```bash
    git clone [https://github.com/username-kamu/nama-repo.git](https://github.com/username-kamu/nama-repo.git)
    ```
2.  **Install Dependencies**
    ```bash
    npm install
    ```
3.  **Setup Environment Variables**
    Buat file `.env` dan isi sesuai `.env.example`.
4.  **Jalankan Server**
    ```bash
    npm run dev
    ```
