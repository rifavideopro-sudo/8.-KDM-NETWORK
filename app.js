// ==========================================
// 0. KONEKSI DATABASE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://aicpdogurnkwvyhnjgng.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DWcuDph3JMVep5Y5ibRxJA_a0lJWBgi';

// Mengaktifkan Supabase
const { createClient } = supabase;

// Sesi login disimpan di sessionStorage, bukan localStorage.
// Efeknya: sesi hilang sendiri begitu tab/browser ditutup, jadi token tidak
// "menggantung" dan tidak bisa dipakai ulang di komputer bersama.
let penyimpananSesi = window.localStorage;
try {
    if (window.sessionStorage) penyimpananSesi = window.sessionStorage;
} catch (e) {
    console.warn('sessionStorage tidak tersedia, memakai localStorage.');
}

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: penyimpananSesi,
        persistSession: true,
        autoRefreshToken: true
    }
});

console.log("Supabase Berhasil Disambungkan!");

// ==========================================
// 0B. PENGAMAN DASAR (ANTI-XSS, ARGUMEN TOMBOL, VALIDASI FILE, CSV)
// ==========================================
// Escaping untuk data yang ditampilkan ke dalam HTML
function esc(nilai) {
    if (nilai === null || nilai === undefined) return '';
    return String(nilai)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Escaping untuk argumen yang ditempel ke onclick="..." (misal nama "Ma'ruf" tidak merusak tombol)
function jsArg(nilai) {
    if (nilai === null || nilai === undefined) return '';
    return String(nilai)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/[\r\n\t]+/g, ' ');
}

// Cegah CSV Injection: sel yang diawali = + - @ bisa dieksekusi Excel
function csvAman(nilai) {
    if (nilai === null || nilai === undefined) return '';
    const teks = String(nilai);
    if (/^[=+\-@\t\r]/.test(teks)) return "'" + teks;
    return teks.replace(/"/g, '""');
}

// Validasi berkas sebelum dikirim ke Storage (ukuran + ekstensi)
function validasiBerkas(file, maksMB, ekstensiBoleh) {
    if (!file) return true;
    const ukuranMB = file.size / (1024 * 1024);
    if (ukuranMB > maksMB) {
        alert(`Ukuran file terlalu besar (${ukuranMB.toFixed(1)} MB). Maksimal ${maksMB} MB.`);
        return false;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ekstensiBoleh.includes(ext)) {
        alert(`Tipe file .${ext} tidak diizinkan. Gunakan: ${ekstensiBoleh.join(', ')}`);
        return false;
    }
    return true;
}

// Status sesi login (dipakai untuk mengunci halaman)
let sesiAktif = false;
let emailLoginAktif = '';

// ==========================================
// 1. LOGIKA LOGIN ASLI (SUPABASE AUTHENTICATION)
// ==========================================
let jabatanAktif = ''; 

async function loginAsli(event) {
    event.preventDefault(); // Cegah halaman reload

    // 1. Trik Otomatis: Boleh ketik 'admin' doang atau email lengkap!
    const inputUser = document.getElementById('username').value.trim();
    const emailLogin = inputUser.includes('@') ? inputUser : `${inputUser}@kdm.net`;
    const passwordInput = document.getElementById('password').value;
    const btnLogin = document.getElementById('btn-login-utama');
    
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi Enkripsi...';
    btnLogin.disabled = true;

    try {
        // 2. Minta Izin Resmi ke Brankas Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: emailLogin,
            password: passwordInput,
        });

        if (authError) throw authError; // Jika password salah, langsung terlempar ke Catch!

        // 3. Jika sukses, ambil data perannya dari tabel akun_user
        const { data: userData } = await supabaseClient
            .from('akun_user')
            .select('*')
            .eq('username', emailLogin)
            .single();
        
        let namaTampil = emailLogin.split('@')[0]; // Ambil nama depan
        jabatanAktif = 'Karyawan'; // Default terendah demi keamanan

        if (userData) {
            namaTampil = userData.nama_lengkap;
            jabatanAktif = userData.role;       
        } 

        // 3B. Tandai sesi aktif + simpan identitas untuk keperluan log
        sesiAktif = true;
        emailLoginAktif = emailLogin;

        // 4. Tampilkan Nama di Pojok Kanan
        const elNamaUser = document.getElementById('userNameDisplay');
        if (elNamaUser) elNamaUser.innerHTML = "Halo, <strong>" + esc(namaTampil) + "</strong>!";
        catatLog(`Login ke dalam sistem aplikasi KDM Network`);

       // =============== GEMBOK TREN PEMASUKAN ===============
        const wadahTren = document.getElementById('wadah-tren-pemasukan');
        if (wadahTren) {
            if (jabatanAktif === 'Karyawan') {
                wadahTren.style.display = 'none'; // Sembunyikan dari pandangan Karyawan
            } else {
                wadahTren.style.display = 'block'; // Tampilkan gagah untuk Bos
            }
        }
        // =============== GEMBOK PENGATURAN ===============
        const tombolPengaturan = document.getElementById('tombol-pengaturan');
        if (tombolPengaturan) {
            if (jabatanAktif === 'Karyawan') {
                tombolPengaturan.style.display = 'none'; 
            } else {
                tombolPengaturan.style.display = 'block'; 
            }
        }
        // =================================================
// =============== GEMBOK CETAK NOTA ===============
        const tombolCetakNota = document.getElementById('menu-cetak-nota');
        if (tombolCetakNota) {
            if (jabatanAktif === 'Karyawan') {
                tombolCetakNota.style.display = 'none'; 
            } else {
                tombolCetakNota.style.display = 'block'; 
            }
        }
        // =================================================
        // =============== GEMBOK CCTV LOG AKTIVITAS ===============
        const tombolLog = document.getElementById('menu-log');
        if (tombolLog) {
            if (jabatanAktif === 'Karyawan') {
                tombolLog.style.display = 'none'; 
            } else {
                tombolLog.style.display = 'block'; 
            }
        }
        // =========================================================
        // =====================================================

        // 5. Buka Pintu Dashboard!
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'flex';
        // 5. Buka pintu dashboard!
document.getElementById('login-screen').classList.remove('active');
document.getElementById('login-screen').style.display = 'none';
document.getElementById('dashboard-screen').style.display = 'flex';

// Munculkan Widget AI setelah login
const wadahAiLogin = document.getElementById('kdm-ai-container');
if (wadahAiLogin) wadahAiLogin.style.display = 'block';
        
        setTimeout(renderGrafik, 100);

    } catch (error) {
        console.error("Serangan / Gagal Login:", error.message);
        alert('🚨 AKSES DITOLAK! Username atau Password Anda Salah!');
    } finally {
        btnLogin.innerHTML = 'Masuk Aplikasi';
        btnLogin.disabled = false;
    }
}

// ==========================================
// 2. LOGIKA NAVIGASI MENU DASHBOARD
// ==========================================
function showPage(pageId) {
    // GEMBOK: halaman dashboard hanya boleh dibuka setelah login berhasil
    if (!sesiAktif) {
        const layarLogin = document.getElementById('login-screen');
        const layarDash = document.getElementById('dashboard-screen');
        if (layarLogin) { layarLogin.classList.add('active'); layarLogin.style.display = 'flex'; }
        if (layarDash) { layarDash.classList.remove('active'); layarDash.style.display = 'none'; }
        return;
    }

    // Sembunyikan semua halaman
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => page.classList.remove('active'));

    // Tampilkan halaman yang diklik
    const halamanTarget = document.getElementById('page-' + pageId);
    if (halamanTarget) halamanTarget.classList.add('active');

    // Ubah warna menu yang aktif di sidebar
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => link.classList.remove('active'));
    
    // Tandai menu yang aktif di sidebar (tanpa bergantung window.event)
    const tautanMenuAktif = document.querySelector(`.nav-links a[onclick*="showPage('${pageId}')"]`);
    if (tautanMenuAktif && tautanMenuAktif.parentElement) {
        tautanMenuAktif.parentElement.classList.add('active');
    }

    // Tutup sidebar setelah menu diklik (Khusus HP)
    if (window.innerWidth <= 768) {
        const sBar = document.getElementById('sidebar');
        if(sBar) sBar.classList.remove('mobile-active');
    }

    // Panggil fungsi sesuai halaman yang dibuka
    if (pageId === 'dashboard') {
        setTimeout(renderGrafik, 100);
    }
    else if (pageId === 'data-pelanggan') {
        ambilDataPelanggan();
    }
    else if (pageId === 'cetak-nota') {
        if (jabatanAktif === 'Karyawan') {
            alert('Akses Ditolak! Menu Cetak Nota khusus Bos/Admin.');
            showPage('dashboard'); 
            return; 
        }
        ambilDataNota();
    }
    else if (pageId === 'pembayaran') {
        ambilDataPembayaran();
    }
    else if (pageId === 'pengaturan') {
        if (jabatanAktif === 'Karyawan') {
            alert('Akses Ditolak! Menu ini khusus admin.');
            showPage('dashboard'); 
            return; 
        }
        ambilDataUser();
        ambilDataMikrotik(); // Memanggil form VPN Mikrotik
    }
    else if (pageId === 'log-aktivitas') {
        if (jabatanAktif === 'Karyawan') {
            alert('Akses Ditolak! Ini Ruang CCTV Rahasia Bos Besar.');
            showPage('dashboard'); 
            return; 
        }
        ambilDataLog(); 
    }
}


// ==========================================
// 3. LOGIKA SIDEBAR UNTUK HP (MOBILE MENU)
// ==========================================
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.getElementById('sidebar');

if(menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('mobile-active');
    });
}

if(closeSidebar) {
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('mobile-active');
    });
}

// ==========================================
// 4. LOGIKA AMBIL KOORDINAT GPS
// ==========================================
function dapatkanKoordinat() {
    const inputKoordinat = document.getElementById('titik_koordinat');
    const statusText = document.getElementById('lokasiStatus');

    if (navigator.geolocation) {
        statusText.innerHTML = "<span style='color: orange;'><i class='fa-solid fa-spinner fa-spin'></i> Sedang mencari sinyal satelit GPS...</span>";
        inputKoordinat.value = "Mencari lokasi...";

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                inputKoordinat.value = lat + ", " + lng;
                statusText.innerHTML = "<span style='color: var(--success);'><i class='fa-solid fa-check-circle'></i> Lokasi akurat berhasil didapatkan!</span>";
            },
            function(error) {
                inputKoordinat.value = "";
                statusText.innerHTML = "<span style='color: var(--danger);'><i class='fa-solid fa-triangle-exclamation'></i> Gagal! Pastikan Izin Lokasi (GPS) aktif.</span>";
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        alert("Browser Anda tidak mendukung fitur lokasi GPS.");
    }
}
// ==========================================
// 4B. LOGIKA AMBIL KOORDINAT GPS (KHUSUS MENU EDIT)
// ==========================================
function dapatkanKoordinatEdit() {
    const inputKoordinat = document.getElementById('edit_koordinat');
    const statusText = document.getElementById('editLokasiStatus');

    if (navigator.geolocation) {
        statusText.innerHTML = "<span style='color: orange;'><i class='fa-solid fa-spinner fa-spin'></i> Mencari sinyal satelit GPS baru...</span>";
        inputKoordinat.value = "Mencari lokasi...";

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                inputKoordinat.value = lat + ", " + lng;
                statusText.innerHTML = "<span style='color: var(--success);'><i class='fa-solid fa-check-circle'></i> Titik GPS baru berhasil didapatkan!</span>";
            },
            function(error) {
                inputKoordinat.value = "";
                statusText.innerHTML = "<span style='color: var(--danger);'><i class='fa-solid fa-triangle-exclamation'></i> Gagal! Pastikan Izin Lokasi (GPS) HP aktif.</span>";
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        alert("Browser Anda tidak mendukung fitur lokasi GPS.");
    }
}
// ==========================================
// 5. LOGIKA SIMPAN DATA PELANGGAN KE SUPABASE
// ==========================================
async function simpanDataPelanggan(event) {
    event.preventDefault();

    const btnSimpan = event.target.querySelector('button[type="submit"]');
    const teksAsliTombol = btnSimpan.innerHTML;
    btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan Data...';
    btnSimpan.disabled = true;

    try {
       // --- LOGIKA ID OTOMATIS CERDAS (FORMAT BARU) ---
        // Format: [OLT_NO_1][URUTAN_4_DIGIT]
        const oltNo = document.getElementById('id_olt_no').value.padStart(4, '0');
        
        // Gabungan awalan ID hanya memakai OLT (misal: 0007)
        const awalanID = `${oltNo}`; 

        // Tarik data dari Supabase yang awalannya sama
        const { data: listCust } = await supabaseClient
            .from('pelanggan')
            .select('no_id_pelanggan')
            .ilike('no_id_pelanggan', `${awalanID}%`);

        let nextUrut = 1;

        if (listCust && listCust.length > 0) {
            // Kumpulkan semua angka urutan (4 digit terakhir)
            let semuaUrutan = listCust.map(p => {
                let id = p.no_id_pelanggan;
                if (id && id.length >= awalanID.length + 4) {
                    let urutStr = id.substring(awalanID.length, awalanID.length + 4);
                    let angka = parseInt(urutStr, 10);
                    return isNaN(angka) ? 0 : angka;
                }
                return 0;
            });
            
            let maxUrut = Math.max(...semuaUrutan);
            nextUrut = maxUrut + 1;
        }

        if (nextUrut > 9999 || nextUrut < 1) {
             nextUrut = 1; 
        }

        const strUrut = String(nextUrut).padStart(4, '0');
        const idResmiBaru = `${awalanID}${strUrut}`; // Hasil akhir: WRG000400070001

        // Upload Foto KTP
        const fileInput = document.getElementById('foto_ktp');
        const file = fileInput.files[0];
        let fotoUrl = null;

        if (file) {
            if (!validasiBerkas(file, 5, ['jpg', 'jpeg', 'png', 'webp'])) return;
            const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const fileName = `ktp-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage.from('foto_ktp').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabaseClient.storage.from('foto_ktp').getPublicUrl(fileName);
            fotoUrl = publicUrlData.publicUrl;
        }

        // Simpan Data
        const dataPelanggan = {
            no_id_pelanggan: idResmiBaru,
            nama_lengkap: document.getElementById('nama_lengkap').value,
            no_ktp: document.getElementById('no_ktp').value,
            no_hp: document.getElementById('no_hp').value,
            user_pppoe: document.getElementById('user_pppoe').value,
            abonemen: parseInt(document.getElementById('abonemen').value),
            tgl_penarikan: parseInt(document.getElementById('tgl_penarikan').value),
            tgl_psb: document.getElementById('tgl_psb').value,
            alamat: document.getElementById('alamat').value,
            titik_koordinat: document.getElementById('titik_koordinat').value,
            catatan_tambahan: document.getElementById('catatan_tambahan').value,
            status: "Aktif",
            status_bayar: "Belum Bayar",
            created_at: new Date().toISOString(),
            foto_ktp_url: fotoUrl
        };

        const { error } = await supabaseClient.from('pelanggan').insert([dataPelanggan]);
        if (error) throw error;

        alert(`MANTAP BOS! Pelanggan berhasil disimpan dengan ID: ${idResmiBaru}`);
        catatLog(`Mendaftarkan pelanggan baru dengan ID: ${idResmiBaru}`);
        event.target.reset();
        showPage('data-pelanggan');

    } catch (error) {
        console.error(error);
        alert('Gagal menyimpan: ' + error.message);
    } finally {
        btnSimpan.innerHTML = teksAsliTombol;
        btnSimpan.disabled = false;
    }
}

// ==========================================
// 6. RENDER GRAFIK & HITUNG STATISTIK OTOMATIS (UANG RIIL & RUTE TAGIHAN)
// ==========================================
async function renderGrafik() {
    let jumlahAktif = 0;
    let jumlahIsolir = 0;
    let pemasukanPerBulan = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    // Wadah data untuk grafik perbandingan rute baru
    let lunasPerRute = [0, 0, 0, 0]; // Index: 0=Tgl1, 1=Tgl10, 2=Tgl15, 3=Tgl20
    let belumPerRute = [0, 0, 0, 0];

    try {
        // ==========================================
        // A. AMBIL DATA PELANGGAN 
        // ==========================================
        const { data: pel, error: errPel } = await supabaseClient
            .from('pelanggan')
            .select('*');

        if (!errPel && pel) {
            jumlahAktif = pel.filter(item => item.status === 'Aktif').length;
            jumlahIsolir = pel.filter(item => item.status === 'Isolir').length;

            const elAktif = document.getElementById('total-aktif');
            const elIsolir = document.getElementById('total-isolir');
            if (elAktif) elAktif.innerText = jumlahAktif;
            if (elIsolir) elIsolir.innerText = jumlahIsolir;

            const hitungPersen = (tgl) => {
                const orgTgl = pel.filter(p => parseInt(p.tgl_penarikan || 10) === tgl && p.status === 'Aktif');
                if (orgTgl.length === 0) return 0;
                const lns = orgTgl.filter(p => p.status_bayar === 'Lunas').length;
                return Math.round((lns / orgTgl.length) * 100);
            };

            if(document.getElementById('lunas-tgl1')) document.getElementById('lunas-tgl1').innerText = hitungPersen(1) + '%';
            if(document.getElementById('lunas-tgl10')) document.getElementById('lunas-tgl10').innerText = hitungPersen(10) + '%';
            if(document.getElementById('lunas-tgl15')) document.getElementById('lunas-tgl15').innerText = hitungPersen(15) + '%';
            if(document.getElementById('lunas-tgl20')) document.getElementById('lunas-tgl20').innerText = hitungPersen(20) + '%';

            // HITUNG MANUAL JUMLAH ORANG LUNAS VS BELUM BAYAR PER RUTE (UNTUK GRAFIK BARU)
            const rute = [1, 10, 15, 20];
            rute.forEach((tgl, index) => {
                const orgTgl = pel.filter(p => parseInt(p.tgl_penarikan || 10) === tgl && p.status === 'Aktif');
                const lns = orgTgl.filter(p => p.status_bayar === 'Lunas').length;
                const blm = orgTgl.length - lns; // Sisanya berarti belum lunas/menunggu
                
                lunasPerRute[index] = lns;
                belumPerRute[index] = blm;
            });
        }

        // ==========================================
        // B. AMBIL DATA TAGIHAN (UANG MASUK)
        // ==========================================
        const { data: tagihanData, error: errTagihan } = await supabaseClient
            .from('tagihan')
            .select('jumlah_tagihan, tgl_lunas')
            .eq('status_bayar', 'Lunas'); 

        if (!errTagihan && tagihanData) {
            tagihanData.forEach(tgh => {
                if (tgh.tgl_lunas && tgh.jumlah_tagihan) {
                    const tgl = new Date(tgh.tgl_lunas);
                    if(tgl.getFullYear() === new Date().getFullYear()){
                        const bulanLunas = tgl.getMonth();
                        pemasukanPerBulan[bulanLunas] += Number(tgh.jumlah_tagihan);
                    }
                }
            });
        }

    } catch (err) {
        console.error('Gagal menghitung statistik:', err);
    }

    Chart.defaults.color = '#8E96B7';
    Chart.defaults.borderColor = '#202654';

    // 1. Grafik Batang UANG RIIL (Tetap sama)
    const ctxBar = document.getElementById('barChart');
    if (ctxBar) {
        if(window.barChartInstance) window.barChartInstance.destroy();
        window.barChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
                datasets: [{
                    label: 'Omset Riil Masuk (Rp)',
                    data: pemasukanPerBulan,
                    backgroundColor: '#00FFD1',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. GRAFIK PERBANDINGAN LUNAS VS BELUM BAYAR (PENGGANTI DONAT)
    const ctxRute = document.getElementById('ruteChart');
    if (ctxRute) {
        if(window.ruteChartInstance) window.ruteChartInstance.destroy();
        window.ruteChartInstance = new Chart(ctxRute, {
            type: 'bar', 
            data: {
                labels: ['Tgl 1', 'Tgl 10', 'Tgl 15', 'Tgl 20'],
                datasets: [
                    {
                        label: 'Lunas',
                        data: lunasPerRute,
                        backgroundColor: '#10B981', // Hijau Sukses
                        borderRadius: 4
                    },
                    {
                        label: 'Belum',
                        data: belumPerRute,
                        backgroundColor: '#EF4444', // Merah Bahaya
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'bottom',
                        labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 10 }
                    } 
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 } // Biar angkanya tidak desimal (1 orang, 2 orang, dst)
                    }
                }
            }
        });
    }
}

// ==========================================
// 7. AMBIL DATA DARI SUPABASE (BACA DATA + TOMBOL MAPS + DISMANTLE)
// ==========================================
async function ambilDataPelanggan() {
    const tbody = document.getElementById('tabel-body-pelanggan');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Sedang menyedot data dari Supabase...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('pelanggan')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Belum ada data pelanggan yang terdaftar.</td></tr>';
            return;
        }

        data.forEach((pelanggan, index) => {
            const tr = document.createElement('tr');
            
            // Logika Warna Badge Status
            let badgeClass = 'badge-aktif';
            let styleTambahan = '';
            
            if (pelanggan.status === 'Isolir') {
                badgeClass = 'badge-isolir';
            } else if (pelanggan.status === 'Dismantle') {
                badgeClass = 'badge-isolir';
                styleTambahan = 'background: #2a2a2a; color: #a1a1aa; border-color: #52525b;'; // Warna abu-abu mati
            }

            // Logika Tombol Aktif/Isolir (Sembunyikan jika sudah Dismantle)
            let tombolAktifIsolir = '';
            if (pelanggan.status !== 'Dismantle') {
                const btnWarna = pelanggan.status === 'Aktif' ? 'var(--warning)' : 'var(--success)';
                const btnTeks = pelanggan.status === 'Aktif' ? 'Isolir' : 'Aktifkan';
                const btnIkon = pelanggan.status === 'Aktif' ? 'fa-ban' : 'fa-check';
                
                tombolAktifIsolir = `
                    <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: ${btnWarna}; border: none; color: #0B0E27; font-weight: bold;" onclick="ubahStatus('${jsArg(pelanggan.no_id_pelanggan)}', '${jsArg(pelanggan.status)}')">
                        <i class="fa-solid ${btnIkon}"></i> ${btnTeks}
                    </button>
                `;
            }

            const koordinatAman = jsArg(pelanggan.titik_koordinat);
            const alamatAman = jsArg(pelanggan.alamat);

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="font-weight: 600;">${esc(pelanggan.nama_lengkap)}</td>
                <td style="color: var(--primary); font-weight: 700;">${esc(pelanggan.no_id_pelanggan)}</td>
                <td>${esc(pelanggan.no_hp)}</td>
                <td>${esc(pelanggan.alamat)}</td>
                <td><span class="${badgeClass}" style="${styleTambahan}">${esc(pelanggan.status)}</span></td>
                <td style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: var(--warning); color: #fff; border: none;" onclick="bukaEditPelanggan('${jsArg(pelanggan.no_id_pelanggan)}')">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: #3B82F6; color: #fff; border: none;" onclick="bukaMaps('${koordinatAman}', '${alamatAman}')">
                        <i class="fa-solid fa-map-location-dot"></i> Maps
                    </button>
                    ${tombolAktifIsolir}
                    ${pelanggan.status !== 'Dismantle' ? `
                        <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: var(--danger); color: white; border: none;" onclick="cabutAlat('${jsArg(pelanggan.no_id_pelanggan)}', '${jsArg(pelanggan.nama_lengkap)}')">
                            <i class="fa-solid fa-plug-circle-xmark"></i> Dismantle
                        </button>
                    ` : `
                        <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: var(--success); color: #0B0E27; border: none; font-weight: bold;" onclick="ubahStatus('${jsArg(pelanggan.no_id_pelanggan)}', 'Isolir')">
                            <i class="fa-solid fa-power-off"></i> Pasang Ulang
                        </button>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error ambil data:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">Gagal menarik data: ${esc(error.message)}</td></tr>`;
    }
}

// FUNGSI PINTAR BUKA GOOGLE MAPS (KOORDINAT / ALAMAT)
function bukaMaps(koordinat, alamat) {
    let targetLokasi = '';
    if (koordinat && koordinat !== 'null' && koordinat !== 'undefined' && koordinat.trim() !== '' && koordinat !== 'Mencari lokasi...') {
        targetLokasi = koordinat.trim();
    } else if (alamat && alamat !== 'null' && alamat !== 'undefined' && alamat.trim() !== '') {
        targetLokasi = alamat.trim();
    } else {
        alert('Waduh Bosku, pelanggan ini belum memiliki titik koordinat maupun alamat yang jelas!');
        return;
    }
    const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetLokasi)}`;
    window.open(urlMaps, '_blank');
}

// FUNGSI KHUSUS UNTUK STATUS DISMANTLE
async function cabutAlat(idPelanggan, nama) {
    const konfirmasi = confirm(`🚨 PERINGATAN!\n\nYakin ingin mengubah status ${nama} menjadi DISMANTLE (Berhenti Berlangganan / Cabut Alat)?\n\nPelanggan ini tidak akan muncul lagi di daftar tagihan.`);
    if (!konfirmasi) return;

    try {
        const { error } = await supabaseClient
            .from('pelanggan')
            .update({ status: 'Dismantle', status_bayar: 'Belum Bayar' })
            .eq('no_id_pelanggan', idPelanggan);

        if (error) throw error;

        alert(`Alat milik ${nama} telah dicabut. Status diubah menjadi Dismantle.`);
        catatLog(`Mencabut alat (Dismantle) pelanggan bernama ${nama}`);
        ambilDataPelanggan(); 
        if(typeof renderGrafik === "function") renderGrafik();
    } catch (error) {
        console.error('Error dismantle:', error);
        alert('Gagal mengubah status: ' + error.message);
    }
}
// ==========================================
// 8. FITUR LIHAT FOTO & UBAH STATUS (TERKONEKSI KE MIKROTIK)
// ==========================================
function lihatKTP(urlKTP) {
    if (!urlKTP || urlKTP === 'null' || urlKTP === 'undefined' || urlKTP === '') {
        alert('Waduh Bosku, pelanggan ini tidak punya file foto!');
        return;
    }
    const urlPerbaikan = urlKTP.replace('/FOTO_KTP/', '/foto_ktp/');
    window.open(urlPerbaikan, '_blank');
}

async function ubahStatus(idPelanggan, statusSekarang) {
    const statusBaru = statusSekarang === 'Aktif' ? 'Isolir' : 'Aktif';
    
    const konfirmasi = confirm(`Yakin ingin mengubah status pelanggan ini menjadi ${statusBaru}?`);
    if (!konfirmasi) return;

    try {
        const { data: pel } = await supabaseClient
            .from('pelanggan')
            .select('user_pppoe')
            .eq('no_id_pelanggan', idPelanggan)
            .single();

        const { error } = await supabaseClient
            .from('pelanggan')
            .update({ status: statusBaru })
            .eq('no_id_pelanggan', idPelanggan);

        if (error) throw error;

        if (pel && pel.user_pppoe) {
            await eksekusiMikrotik(pel.user_pppoe, statusBaru);
        }

        alert(`Mantap! Status di web berhasil diubah menjadi ${statusBaru}.`);
        catatLog(`Mengubah status ID ${idPelanggan} menjadi${statusBaru}`);
        ambilDataPelanggan();
        
    } catch (error) {
        console.error('Error ubah status:', error);
        alert('Gagal mengubah status: ' + error.message);
    }
}

// ==========================================
// 9. FITUR CETAK NOTA (SATUAN & MASSAL KHUSUS AKTIF)
// ==========================================

// Variabel penampung daftar pelanggan yang sedang difilter untuk cetak massal
let daftarPelangganCetak = [];

async function ambilDataNota() {
    const tbody = document.getElementById('tabel-body-nota');
    const filterTgl = document.getElementById('filter-tgl-nota').value;
    const spanJumlah = document.getElementById('jumlah-nota-cetak');
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan data tagihan...</td></tr>';

    try {
        // 1. Tarik semua pelanggan aktif (Pakai ilike agar kebal kalau ada salah ketik huruf kecil/spasi di Supabase)
        let query = supabaseClient
            .from('pelanggan')
            .select('*')
            .ilike('status', '%ktif%')
            .order('nama_lengkap', { ascending: true });

        const { data, error } = await query;
        if (error) throw error;

        // 2. JURUS KEBAL ERROR: Kita filter tanggalnya langsung di Javascript pakai (==) agar tidak rewel soal format Angka/Teks!
        let hasilFilter = data || [];
        if (filterTgl !== 'semua') {
            hasilFilter = hasilFilter.filter(p => p.tgl_penarikan == filterTgl);
        }

        // Simpan hasil filter ke variabel global & update angka di tombol Print Semua
        daftarPelangganCetak = hasilFilter;
        if (spanJumlah) spanJumlah.innerText = daftarPelangganCetak.length;

        tbody.innerHTML = '';

        if (daftarPelangganCetak.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Tidak ada pelanggan aktif untuk kriteria tanggal ini.</td></tr>';
            return;
        }

        daftarPelangganCetak.forEach((p, index) => {
            const tr = document.createElement('tr');
            const nominalRupiah = Number(p.abonemen || 0).toLocaleString('id-ID');

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="color: var(--primary); font-weight: 700;">${esc(p.no_id_pelanggan)}</td>
                <td style="font-weight: 600;">${esc(p.nama_lengkap || 'Tanpa Nama')}</td>
                <td>${esc(p.user_pppoe || '-')}</td>
                <td><span class="badge-aktif">Tgl ${esc(p.tgl_penarikan || '-')}</span></td>
                <td style="font-weight: 700; color: var(--success);">Rp ${nominalRupiah}</td>
                <td>
                    <button class="btn-primary" style="padding: 8px 14px; font-size: 12px;" 
                        onclick="cetakStruk('${jsArg(p.no_id_pelanggan)}', '${jsArg(p.nama_lengkap)}', '${jsArg(p.user_pppoe || '-')}', '${jsArg(p.alamat || '-')}', '${jsArg(p.tgl_penarikan || '-')}', ${Number(p.abonemen) || 0}, '${jsArg(p.no_hp || '-')}', '${jsArg(p.tgl_psb || '')}')">
                        <i class="fa-solid fa-print"></i> Print Nota
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error ambil data nota:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">Gagal memuat data: ${esc(error.message)}</td></tr>`;
    }
}

// ==========================================
// 10. FUNGSI PENGUBAH ANGKA JADI TEKS (TERBILANG)
// ==========================================
function terbilang(angka) {
    var bilangan = ['','Satu','Dua','Tiga','Empat','Lima','Enam','Tujuh','Delapan','Sembilan','Sepuluh','Sebelas'];
    if (angka < 12) return bilangan[angka];
    if (angka < 20) return terbilang(angka - 10) + ' Belas';
    if (angka < 100) return terbilang(Math.floor(angka / 10)) + ' Puluh ' + terbilang(angka % 10);
    if (angka < 200) return 'Seratus ' + terbilang(angka - 100);
    if (angka < 1000) return terbilang(Math.floor(angka / 100)) + ' Ratus ' + terbilang(angka % 100);
    if (angka < 2000) return 'Seribu ' + terbilang(angka - 1000);
    if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + ' Ribu ' + terbilang(angka % 1000);
    if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + ' Juta ' + terbilang(angka % 1000000);
    return '';
}

// ==========================================
// 11. PEMBUAT TEMPLATE HTML 1 LEMBAR A4 (2 NOTA ATAS-BAWAH)
// ==========================================
function buatHalamanA4Nota(idPel, nama, pppoe, alamat, tglTagih, nominal, hp, tglPsbPelanggan) {
    // ESCAPE SELURUH DATA CETAK (aman dari HTML/script yang disisipkan di nama atau alamat)
    idPel = esc(idPel);
    nama = esc(nama);
    pppoe = esc(pppoe);
    alamat = esc(alamat);
    tglTagih = esc(tglTagih);
    hp = esc(hp);
    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const tahunSekarang = new Date().getFullYear();
    const bulanSekarangIndex = new Date().getMonth();
    const namaBulanIni = namaBulan[bulanSekarangIndex];
    
    const tglNota = tglTagih + " " + namaBulanIni + " " + tahunSekarang;
    const periodeTagihan = "Abonemen internet bulan " + namaBulanIni + " " + tahunSekarang;

    const d = new Date();
    const hariPrint = String(d.getDate()).padStart(2, '0');
    const bulanPrint = namaBulan[d.getMonth()];
    const tahunPrint = d.getFullYear();
    const jamPrint = String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0');
    const tglPrintFull = `${hariPrint} ${bulanPrint} ${tahunPrint}, Pukul ${jamPrint}`;

    let formatTglPsb = "-";
    if (tglPsbPelanggan && tglPsbPelanggan !== 'null' && tglPsbPelanggan !== 'undefined' && tglPsbPelanggan !== '') {
        const psbDate = new Date(tglPsbPelanggan);
        if (!isNaN(psbDate.getTime())) {
            const hariPsb = String(psbDate.getDate()).padStart(2, '0');
            const bulanPsb = namaBulan[psbDate.getMonth()];
            const thnPsb = psbDate.getFullYear();
            formatTglPsb = `${hariPsb} ${bulanPsb} ${thnPsb}`;
        }
    }

    const angkaNominal = Number(nominal) || 0;
    const rupiah = angkaNominal.toLocaleString('id-ID');
    const teksTerbilang = (angkaNominal > 0 ? terbilang(angkaNominal) : "Nol") + " Rupiah";
    const noKwitansi = idPel;

    const kontenSatuNota = `
        <div class="nota">
            <div class="kop">
                <div class="kop-kiri">
                    <img src="logo.png" alt="Logo" style="width: 65px; height: 65px; object-fit: contain; margin-bottom: 3px;">
                    <div class="logo-teks">KDM Network</div>
                    <div class="logo-subteks">Network Installation & Payment point</div>
                </div>
                
                <div class="kop-tengah">
                    <h1>KDM Network</h1>
                    <div class="sub-judul">Network Installation & Payment point</div>
                    <div class="alamat-kantor">
                        Office : Dsn. Krajan RT. 05 RW 03, Ds. Kedemungan Kec. Kejayan
                    </div>
                </div>
                
                <div class="kop-kanan">
                    <table class="tabel-kontak">
                        <tr><td>Customer Care</td><td>: 0851-3683-8577</td></tr>
                        <tr><td>Teknisi Lokal</td><td>: 0878-4451-1830</td></tr>
                    </table>
                </div>
            </div>
            
            <div class="garis-ganda"></div>

            <table class="tabel-kwitansi">
                <tr>
                    <td width="55%"></td>
                    <td width="15%">No. Kwitansi</td>
                    <td width="30%">: ${noKwitansi}</td>
                </tr>
                <tr>
                    <td></td>
                    <td>Tanggal</td>
                    <td>: ${tglNota}</td>
                </tr>
            </table>

            <table class="tabel-isi">
                <tr>
                    <td width="19%">Terima dari</td>
                    <td width="2%">:</td>
                    <td width="79%" colspan="4"><strong>${nama}</strong></td>
                </tr>
                <tr>
                    <td>Alamat</td>
                    <td>:</td>
                    <td colspan="4">${alamat}</td>
                </tr>
                <tr>
                    <td>Untuk Pembayaran</td>
                    <td>:</td>
                    <td colspan="4">${periodeTagihan}</td>
                </tr>
                <tr>
                    <td>Tagihan</td>
                    <td>:</td>
                    <td width="5%">Rp.</td>
                    <td width="25%">${rupiah}</td>
                    <td width="15%">Nomer Hp</td>
                    <td width="34%">: ${hp}</td>
                </tr>
                <tr>
                    <td>Lain-lain</td>
                    <td>:</td>
                    <td>Rp.</td>
                    <td>-</td>
                    <td>User</td>
                    <td>: ${pppoe}</td>
                </tr>
                <tr>
                    <td>Jumlah</td>
                    <td>:</td>
                    <td>Rp.</td>
                    <td><strong>${rupiah}</strong></td>
                    <td colspan="2"></td>
                </tr>
                <tr>
                    <td style="vertical-align: middle;">Terbilang</td>
                    <td style="vertical-align: middle;">:</td>
                    <td colspan="4"><div class="terbilang-box"># ${teksTerbilang} #</div></td>
                </tr>
            </table>

            <div class="ttd-area">
                <div class="box-rekening">
                    <div style="font-style:italic; font-weight:normal;">Bisa dibayarkan ke</div>
                    <div style="font-size: 16px; font-weight: bold;">Mandiri 144-00-20258650</div>
                    <div style="font-style:italic; font-weight:normal;">a.n : Ferry Andhi Setiawan</div>
                    <div style="font-size: 16px; font-weight: bold;">BCA 8945106928</div>
                    <div style="font-style:italic; font-weight:normal;">a.n : Yunita</div>
                </div>
                
                <div class="ttd-box">
                    <div style="margin-bottom: 48px;">Petugas</div>
                    <div class="garis-ttd"></div>
                </div>
                
                <div class="ttd-box">
                    <div>Pasuruan, ${tglNota}</div>
                    <div style="margin-bottom: 32px;">Customer</div>
                    <div style="font-weight: bold; font-size: 15px;">${nama}</div>
                    <div class="garis-ttd"></div>
                </div>
            </div>

            <div class="footer-bawah">
                <div>
                    Printed &nbsp;: ${tglPrintFull}<br>
                    PSB &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${formatTglPsb}
                </div>
                <div style="font-style: italic; font-family: 'Times New Roman', serif; font-size: 12px;">
                    Powered by PT.Data Buana Nusantara
                </div>
            </div>
        </div>
    `;

    return `
        <div class="a4-kertas">
            ${kontenSatuNota}
            <div class="garis-potong"></div>
            ${kontenSatuNota}
        </div>
    `;
}

// ==========================================
// 12. FUNGSI MEMBUKA JENDELA PREVIEW & PRINT (SATUAN & MASSAL)
// ==========================================
function bukaJendelaCetak(judulDokumen, kumpulanHalamanHTML, jumlahLembar) {
    const jendelaPrint = window.open('', '_blank', 'width=900,height=950');
    jendelaPrint.document.write(`
        <html>
        <head>
            <title>${esc(judulDokumen)}</title>
            <style>
                @page { size: A4 portrait; margin: 0; }
                
                body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; }
                
                .a4-kertas { width: 210mm; height: 296mm; background: white; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; padding: 6mm 12mm; margin: 15px auto; box-shadow: 0 0 12px rgba(0,0,0,0.6); overflow: hidden; page-break-after: always; }
                .a4-kertas:last-child { page-break-after: avoid; }
                
                .nota { height: 48.5%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
                
                .garis-potong { border-top: 1px dashed #666; width: 100%; position: relative; margin: 0; }
                .garis-potong::after { content: '✂️ Potong di sini'; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: white; padding: 0 10px; font-size: 11px; color: #444; font-family: sans-serif; }
                
                .kop { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 2px; }
                .kop-kiri { width: 20%; text-align: center; display: flex; flex-direction: column; align-items: center; }
                .logo-teks { font-size: 13px; font-weight: bold; line-height: 1.1; }
                .logo-subteks { font-size: 7px; line-height: 1.1; }
                
                .kop-tengah { width: 52%; text-align: center; }
                .kop-tengah h1 { margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 0.5px; line-height: 1; }
                .sub-judul { margin: 4px 0; font-size: 16px; font-weight: bold; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2px 10px; display: inline-block; }
                .alamat-kantor { font-size: 12px; margin-top: 2px; }
                
                .kop-kanan { width: 28%; display: flex; justify-content: flex-end; }
                .tabel-kontak { width: auto; font-size: 12px; font-weight: 500; }
                .tabel-kontak td { padding: 1px 2px; }
                
                .garis-ganda { border-top: 3px double #000; margin: 4px 0; }
                
                .tabel-kwitansi { width: 100%; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                .tabel-kwitansi td { padding: 1px 2px; }
                
                .tabel-isi { width: 100%; font-size: 14.5px; border-collapse: collapse; }
                .tabel-isi td { padding: 2.5px 2px; vertical-align: top; }
                
                .terbilang-box { background-color: #dcdcdc; padding: 4px 10px; font-style: italic; font-weight: bold; font-size: 14.5px; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                
                .ttd-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; }
                .box-rekening { border: 2.5px solid #000; padding: 6px 12px; font-size: 14px; line-height: 1.3; width: 36%; box-sizing: border-box; }
                .ttd-box { text-align: center; width: 28%; font-size: 14px; }
                .garis-ttd { border-bottom: 1.5px solid #000; width: 85%; margin: 2px auto 0 auto; }
                
                .footer-bawah { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; font-size: 11px; font-family: monospace; }
                
                @media print {
                    body { background: none; margin: 0; display: block; }
                    .a4-kertas { box-shadow: none; margin: 0; width: 210mm; height: 296mm; page-break-after: always; }
                    .a4-kertas:last-child { page-break-after: avoid; }
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
                <button onclick="window.print()" style="background: #4F46E5; color: white; border: none; padding: 14px 26px; font-size: 15px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
                    🖨️ Cetak Sekarang (${jumlahLembar} Lembar A4)
                </button>
            </div>

            ${kumpulanHalamanHTML}
        </body>
        </html>
    `);
    jendelaPrint.document.close();
}

// Fungsi saat tombol "Print Nota" (Satuan) diklik
function cetakStruk(idPel, nama, pppoe, alamat, tglTagih, nominal, hp, tglPsbPelanggan) {
    const satuLembarHTML = buatHalamanA4Nota(idPel, nama, pppoe, alamat, tglTagih, nominal, hp, tglPsbPelanggan);
    bukaJendelaCetak(`Cetak Nota - ${nama}`, satuLembarHTML, 1);
}

// Fungsi saat tombol "Print Semua" (Massal sesuai filter tanggal) diklik
function cetakSemuaNota() {
    if (!daftarPelangganCetak || daftarPelangganCetak.length === 0) {
        alert('Tidak ada data pelanggan aktif untuk dicetak pada pilihan tanggal ini!');
        return;
    }

    const filterTgl = document.getElementById('filter-tgl-nota').value;
    const labelFilter = filterTgl === 'semua' ? 'Semua Tanggal (1, 10, 15 & 20)' : `Jatuh Tempo Tanggal ${filterTgl}`;

    let gabunganSemuaKertas = '';
    daftarPelangganCetak.forEach(p => {
        gabunganSemuaKertas += buatHalamanA4Nota(
            p.no_id_pelanggan,
            p.nama_lengkap,
            p.user_pppoe || '-',
            p.alamat || '-',
            p.tgl_penarikan || '-',
            p.abonemen || 0,
            p.no_hp || '-',
            p.tgl_psb || ''
        );
    });

    bukaJendelaCetak(`Cetak Massal - ${labelFilter}`, gabunganSemuaKertas, daftarPelangganCetak.length);
}



// ==========================================
// 13. SISTEM PEMBAYARAN PELANGGAN (MENU SENDIRI) & LINK TANPA LOGIN
// ==========================================

let idPelangganBayarSaatIni = null;
let intervalPantauPelanggan = null; // Variabel penampung radar otomatis

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idBayar = urlParams.get('bayar');

    if (idBayar) {
        // Jika link pelanggan (?bayar=KDM-xxx) dibuka, langsung tampilkan layar bayar tanpa login
        bukaHalamanBayarPelanggan(idBayar);
    } else {
        // Jika Admin yang buka, nyalakan radar notifikasi suara & banner
        aktifkanRadarNotifikasiAdmin();
    }
});

/// ==========================================
// Fungsi Mengambil Data untuk Menu "Pembayaran" (Dengan DOUBLE FILTER)
// ==========================================
async function ambilDataPembayaran() {
    const tbody = document.getElementById('tabel-body-pembayaran');
    
    // Ambil nilai dari 2 kotak filter
    const filterTglEl = document.getElementById('filter-tgl-bayar');
    const filterStatusEl = document.getElementById('filter-status-bayar');
    
    if (!tbody) return;

    const filterTgl = filterTglEl ? filterTglEl.value : 'semua';
    const filterStatus = filterStatusEl ? filterStatusEl.value : 'semua';
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data pembayaran...</td></tr>';

    try {
        let query = supabaseClient
            .from('pelanggan')
            .select('*')
            .eq('status', 'Aktif')
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        // --- PROSES FILTER GANDA ---
        let hasilFilter = data || [];

        // 1. Saring Tanggalnya Dulu
        if (filterTgl !== 'semua') {
            hasilFilter = hasilFilter.filter(p => p.tgl_penarikan == filterTgl);
        }

        // 2. Saring Statusnya Kemudian
        if (filterStatus !== 'semua') {
            hasilFilter = hasilFilter.filter(p => {
                const st = p.status_bayar || 'Belum Bayar';
                return st === filterStatus;
            });
        }

        tbody.innerHTML = '';

        if (hasilFilter.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Tidak ada data pelanggan untuk kombinasi rute & status ini.</td></tr>';
            return;
        }

        hasilFilter.forEach((p, index) => {
            const tr = document.createElement('tr');
            const rupiah = Number(p.abonemen || 0).toLocaleString('id-ID');
            const stBayar = p.status_bayar || 'Belum Bayar';

            let badgeHTML = `<span class="badge-isolir" style="display: inline-block; white-space: nowrap;">❌ Belum Bayar</span>`;
            if (stBayar === 'Menunggu Konfirmasi') {
                badgeHTML = `<span class="badge-isolir" style="color:#FF9F00; border-color:#FF9F00; background:rgba(255,159,0,0.15); display: inline-block; white-space: nowrap;">⏳ Menunggu Konfirmasi</span>`;
            } else if (stBayar === 'Lunas') {
                badgeHTML = `<span class="badge-aktif" style="display: inline-block; white-space: nowrap;">✅ Lunas</span>`;
            }

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="color: var(--primary); font-weight: 700;">${esc(p.no_id_pelanggan)}</td>
                <td style="font-weight: 600;">${esc(p.nama_lengkap)}</td>
                <td style="font-weight: 700; color: var(--success);">Rp ${rupiah}</td>
                <td>${badgeHTML}</td>
                
                <!-- KOLOM LINK TAGIHAN & WA -->
                <td style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn-location" style="padding: 6px 12px; font-size: 12px; background: #25D366; color: #fff; border: none; font-weight: bold; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);" onclick="kirimWA('${jsArg(p.no_hp)}', '${jsArg(p.nama_lengkap)}', '${jsArg(p.no_id_pelanggan)}', '${jsArg(rupiah)}')">
                        <i class="fa-brands fa-whatsapp" style="font-size: 14px;"></i> Tagih WA
                    </button>
                    <button class="btn-location" style="padding: 6px 12px; font-size: 12px; background: #3B82F6; color: #fff; border: none;" onclick="salinLinkBayar('${jsArg(p.no_id_pelanggan)}', '${jsArg(p.nama_lengkap)}')">
                        <i class="fa-solid fa-link"></i> Copy Link
                    </button>
                </td>

                <!-- KOLOM KONFIRMASI BAYAR -->
                <td style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${p.bukti_bayar_url ? `
                        <button class="btn-location" style="padding: 6px 10px; font-size: 12px; background: var(--primary); border: none;" onclick="lihatKTP('${jsArg(p.bukti_bayar_url)}')">
                            <i class="fa-solid fa-receipt"></i> Bukti TF
                        </button>
                    ` : ''}
                    
                    ${stBayar === 'Menunggu Konfirmasi' ? `
                        <button class="btn-primary" style="padding: 6px 12px; font-size: 12px; background: var(--success); color: #0B0E27; font-weight: 800;" onclick="konfirmasiLunasTransfer('${jsArg(p.no_id_pelanggan)}', '${jsArg(p.nama_lengkap)}')">
                            <i class="fa-solid fa-check-double"></i> Validasi Lunas
                        </button>
                    ` : stBayar === 'Belum Bayar' ? `
                        <button class="btn-primary" style="padding: 6px 12px; font-size: 12px; background: var(--warning); color: #fff; font-weight: 800; border: none;" onclick="konfirmasiLunasCash('${jsArg(p.no_id_pelanggan)}', '${jsArg(p.nama_lengkap)}')">
                            <i class="fa-solid fa-camera"></i> Terima Tunai
                        </button>
                    ` : `
                        <button class="btn-location" style="padding: 6px 10px; font-size: 11px;" onclick="resetTagihanBulanBaru('${jsArg(p.no_id_pelanggan)}')">
                            Reset Bulan Baru
                        </button>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Gagal memuat pembayaran:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">Gagal memuat data: ${esc(err.message)}</td></tr>`;
    }
}

// Fungsi Kirim WA Otomatis
function kirimWA(noHp, nama, idPel, nominal) {
    if (!noHp || noHp === '-' || noHp === 'null' || noHp === 'undefined') {
        alert('Waduh Bosku, nomor HP pelanggan ini belum diisi di database!');
        return;
    }

    // Ubah 08 jadi 628 otomatis
    let noWaFormatted = noHp.toString().trim();
    if (noWaFormatted.startsWith('0')) {
        noWaFormatted = '62' + noWaFormatted.substring(1);
    }

    const baseUrl = window.location.origin + window.location.pathname;
    const linkUnik = `${baseUrl}?bayar=${idPel}`;
    
    // Teks pesan WA yang akan dikirim (bisa dimodifikasi)
    const pesan = `Halo Kak *${nama}*,\n\nBerikut adalah informasi tagihan WiFi KDM Network bulan ini sebesar *Rp ${nominal}*.\n\nSilakan klik link resmi berikut untuk melihat detail dan melakukan pembayaran mandiri:\n${linkUnik}\n\nTerima kasih! 🙏`;
    
    const urlWa = `https://wa.me/${noWaFormatted}?text=${encodeURIComponent(pesan)}`;
    window.open(urlWa, '_blank');
}

// Fungsi Salin Link untuk dikirim manual
function salinLinkBayar(idPel, nama) {
    const baseUrl = window.location.origin + window.location.pathname;
    const linkUnik = `${baseUrl}?bayar=${idPel}`;
    
    navigator.clipboard.writeText(linkUnik).then(() => {
        alert(`Link Pembayaran untuk ${nama} berhasil disalin!\n\nLink: ${linkUnik}\n\nSilakan kirim ke WA pelanggan atau buka di tab baru untuk mengetes!`);
    });
}

// ==========================================
// Fungsi Menampilkan Halaman Tagihan Pelanggan (Tanpa Login) + RADAR REALTIME
// ==========================================
async function bukaHalamanBayarPelanggan(idPel) {
    idPelangganBayarSaatIni = idPel;

    if (intervalPantauPelanggan) clearInterval(intervalPantauPelanggan);

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'none';

    const payScreen = document.getElementById('customer-pay-screen');
    payScreen.style.display = 'flex';
    payScreen.classList.add('active');

    try {
        // CARA 1 (utama): lewat RPC aman, hanya mengembalikan kolom yang memang ditampilkan
        let data = null;
        const rpcTagihan = await supabaseClient.rpc('tagihan_publik', { p_id: idPel });

        if (!rpcTagihan.error && rpcTagihan.data) {
            data = rpcTagihan.data;
        } else {
            // CARA 2 (cadangan): baca tabel langsung, dipakai bila RPC belum dipasang
            const hasilTabel = await supabaseClient
                .from('pelanggan')
                .select('*')
                .eq('no_id_pelanggan', idPel)
                .single();
            data = hasilTabel.data;
        }

        if (!data) {
            alert('Data tagihan pelanggan tidak ditemukan!');
            return;
        }

        // Data rekening & QRIS untuk pelanggan (tanpa kredensial Mikrotik)
        let setToko = null;
        const rpcSet = await supabaseClient.rpc('pengaturan_publik');

        if (!rpcSet.error && rpcSet.data) {
            setToko = rpcSet.data;
        } else {
            const tabelSet = await supabaseClient
                .from('pengaturan_pembayaran')
                .select('*')
                .eq('id', 1)
                .single();
            setToko = tabelSet.data;
        }

        const qrisGambar = (setToko && setToko.qris_url) ? setToko.qris_url : 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=KDM-NETWORK';
        const txtDana = (setToko && setToko.no_dana) ? setToko.no_dana : '-';
        const txtBca = (setToko && setToko.no_bca) ? setToko.no_bca : '-';
        const txtBri = (setToko && setToko.no_bri) ? setToko.no_bri : '-';
        const txtMandiri = (setToko && setToko.no_mandiri) ? setToko.no_mandiri : '-';

        const nominal = Number(data.abonemen || 0).toLocaleString('id-ID');
        const stBayar = data.status_bayar || 'Belum Bayar';

        document.getElementById('pay-id').innerText = data.no_id_pelanggan;
        document.getElementById('pay-nama').innerText = data.nama_lengkap;
        document.getElementById('pay-tempo').innerText = `Tanggal ${data.tgl_penarikan || 10} setiap bulan`;
        document.getElementById('pay-nominal').innerText = `Rp ${nominal}`;

        const elStatus = document.getElementById('pay-status');
        elStatus.innerText = stBayar;

        if (stBayar === 'Lunas') {
            elStatus.className = 'badge-aktif';
            
            // Simpan data ke variabel global agar bisa dipakai oleh fungsi cetak di bawah
            window.dataTagihanAktif = data;

            // Layar sukses sangat bersih, tidak ada kode nota tersembunyi
            document.getElementById('area-form-bayar').innerHTML = `
                <div style="padding: 24px; background: rgba(0, 255, 209, 0.1); border: 1px solid var(--success); border-radius: 10px; color: var(--success); text-align: center; margin-bottom: 20px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 42px; margin-bottom: 10px;"></i>
                    <h3 style="margin: 0; font-size: 16px;">Tagihan Bulan Ini LUNAS!</h3>
                    <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Terima kasih atas pembayaran Anda. Selamat menikmati layanan internet KDM Network.</p>
                </div>

                <button id="btn-download-nota" class="btn-primary" style="width: 100%; background: var(--success); color: #0B0E27; font-weight: 800; font-size: 14px; padding: 14px;" onclick="unduhENotaJPG()">
                    <i class="fa-solid fa-download"></i> Unduh E-Nota Resmi (JPG)
                </button>
                
                <div id="notif-download-sukses" style="display: none; text-align: center; padding: 12px; background: rgba(0, 255, 209, 0.1); border: 1px solid var(--success); border-radius: 8px; color: var(--success); margin-top: 10px; font-weight: bold; font-size: 13px;">
                    <i class="fa-solid fa-check-circle"></i> E-Nota telah tersimpan di Galeri HP Anda!
                </div>
            `;
        } else if (stBayar === 'Menunggu Konfirmasi') {
            elStatus.className = 'badge-isolir';
            elStatus.style.color = '#FF9F00';
            elStatus.style.borderColor = '#FF9F00';
            document.getElementById('area-form-bayar').innerHTML = `
                <div style="padding: 24px; background: rgba(255, 159, 0, 0.1); border: 1px solid #FF9F00; border-radius: 10px; color: #FF9F00;">
                    <i class="fa-solid fa-clock" style="font-size: 42px; margin-bottom: 10px;"></i>
                    <h3>Bukti Transfer Sedang Diverifikasi</h3>
                    <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">Admin kami telah menerima notifikasi pembayaran Anda dan sedang mengecek mutasi. Mohon tunggu sebentar.</p>
                </div>
            `;

            intervalPantauPelanggan = setInterval(async () => {
                const { data: cekData } = await supabaseClient
                    .from('pelanggan')
                    .select('status_bayar')
                    .eq('no_id_pelanggan', idPel)
                    .single();
                
                if (cekData && cekData.status_bayar === 'Lunas') {
                    clearInterval(intervalPantauPelanggan);
                    bukaHalamanBayarPelanggan(idPel); 
                }
            }, 3000); 

        } else {
             const defaultFormBayar = `
                <div style="background: #ffffff; color: #000; padding: 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
                    <p style="font-weight: 800; font-size: 14px; margin-bottom: 8px; color: #0B0E27; text-align: center;">SCAN QRIS / DANA / OVO</p>
                    <img src="${qrisGambar}" alt="QRIS Pembayaran" style="width: 100%; max-width: 250px; height: auto; margin: 0 auto 10px auto; display: block; border: 2px solid #eee; padding: 6px; border-radius: 8px; object-fit: contain;">
                    <div style="font-size: 12.5px; background: #f4f6f9; padding: 12px; border-radius: 6px; text-align: left; line-height: 1.6;">
                        <strong style="display: block; margin-bottom: 4px;">Atau Transfer Manual ke Rekening:</strong>
                        🏦 <strong>DANA/OVO:</strong> ${txtDana}<br>
                        🏦 <strong>BCA:</strong> ${txtBca}<br>
                        🏦 <strong>BRI:</strong> ${txtBri}<br>
                        🏦 <strong>Mandiri:</strong> ${txtMandiri}
                    </div>
                </div>

                <div style="text-align: left; margin-bottom: 20px;">
                    <label style="color: var(--text-dark); display: block; margin-bottom: 8px;">
                        <i class="fa-solid fa-camera" style="color: var(--primary);"></i> Wajib Upload Screenshot / Foto Bukti Transfer:
                    </label>
                    <input type="file" id="file_bukti_bayar" accept="image/*" onchange="cekFileBukti()">
                </div>

                <button id="btn-kirim-bukti" class="btn-primary" onclick="kirimBuktiPembayaran()" disabled style="width: 100%; opacity: 0.5; cursor: not-allowed;">
                    <i class="fa-solid fa-paper-plane"></i> Pilih Foto Bukti Dulu...
                </button>
            `;
            document.getElementById('area-form-bayar').innerHTML = defaultFormBayar;
        }
    } catch (err) {
        console.error(err);
    }
}
function cekFileBukti() {
    const fileInput = document.getElementById('file_bukti_bayar');
    const btnKirim = document.getElementById('btn-kirim-bukti');
    
    if (fileInput.files && fileInput.files.length > 0) {
        btnKirim.disabled = false;
        btnKirim.style.opacity = '1';
        btnKirim.style.cursor = 'pointer';
        btnKirim.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Bukti Pembayaran Sekarang';
    } else {
        btnKirim.disabled = true;
        btnKirim.style.opacity = '0.5';
        btnKirim.style.cursor = 'not-allowed';
        btnKirim.innerHTML = 'Pilih Foto Bukti Dulu...';
    }
}

async function kirimBuktiPembayaran() {
    const fileInput = document.getElementById('file_bukti_bayar');
    const file = fileInput.files[0];
    if (!file || !idPelangganBayarSaatIni) return;
    if (!validasiBerkas(file, 5, ['jpg', 'jpeg', 'png', 'webp'])) return;

    const btnKirim = document.getElementById('btn-kirim-bukti');
    btnKirim.disabled = true;
    btnKirim.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Bukti ke Admin...';

    try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `bukti-${String(idPelangganBayarSaatIni).replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now()}.${ext}`;

        const { error: upErr } = await supabaseClient
            .storage
            .from('bukti_bayar')
            .upload(fileName, file);

        if (upErr) throw upErr;

        const { data: urlData } = supabaseClient
            .storage
            .from('bukti_bayar')
            .getPublicUrl(fileName);

        // CARA 1 (utama): RPC aman, hanya boleh mengubah 2 kolom ini
        const rpcKirim = await supabaseClient.rpc('kirim_bukti_bayar', {
            p_id: idPelangganBayarSaatIni,
            p_url: urlData.publicUrl
        });

        // CARA 2 (cadangan): update langsung, dipakai bila RPC belum dipasang
        if (rpcKirim.error) {
            const { error: dbErr } = await supabaseClient
                .from('pelanggan')
                .update({
                    status_bayar: 'Menunggu Konfirmasi',
                    bukti_bayar_url: urlData.publicUrl
                })
                .eq('no_id_pelanggan', idPelangganBayarSaatIni);

            if (dbErr) throw dbErr;
        }

        alert('BERHASIL! Bukti pembayaran Anda telah terkirim ke Admin.');
        bukaHalamanBayarPelanggan(idPelangganBayarSaatIni);

    } catch (err) {
        alert('Gagal mengirim bukti: ' + err.message);
        btnKirim.disabled = false;
        btnKirim.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim Bukti Pembayaran Sekarang';
    }
}

// ==========================================
// 14. RADAR NOTIFIKASI SUARA & BANNER REAL-TIME
// ==========================================
function bunyikanSuaraNotif() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
        };
        playTone(880, 0, 0.25);
        playTone(1174.66, 0.2, 0.45);
    } catch (e) {}
}

function tampilkanBannerNotif(nama, nominal) {
    bunyikanSuaraNotif();

    const rupiah = Number(nominal || 0).toLocaleString('id-ID');
    const banner = document.getElementById('wa-notif-banner');
    const teks = document.getElementById('wa-notif-text');

    if (banner && teks) {
        teks.innerHTML = `<strong>${esc(nama)}</strong> (Tagihan Rp ${rupiah}) baru saja mengirim bukti transfer!`;
        banner.style.display = 'block';
        setTimeout(() => { banner.style.display = 'none'; }, 10000);
    }

    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🔔 Pembayaran Baru - KDM Network", {
            body: `${nama} (Rp ${rupiah}) telah mengirim bukti transfer. Cek sekarang!`,
            icon: "images.jfif"
        });
    }
}

// Saat banner notifikasi diklik, langsung lompat ke menu Pembayaran!
function bukaDariNotif() {
    document.getElementById('wa-notif-banner').style.display = 'none';
    showPage('pembayaran');
}

let daftarMenungguSebelumnya = new Set();
let cekPertamaKali = true;

function aktifkanRadarNotifikasiAdmin() {
    document.addEventListener('click', () => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, { once: true });

    setInterval(async () => {
        try {
            const { data } = await supabaseClient
                .from('pelanggan')
                .select('no_id_pelanggan, nama_lengkap, abonemen, status_bayar')
                .eq('status_bayar', 'Menunggu Konfirmasi');

            if (data) {
                data.forEach(item => {
                    if (!daftarMenungguSebelumnya.has(item.no_id_pelanggan)) {
                        daftarMenungguSebelumnya.add(item.no_id_pelanggan);
                        if (!cekPertamaKali) {
                            tampilkanBannerNotif(item.nama_lengkap, item.abonemen);
                            ambilDataPembayaran();
                        }
                    }
                });
                const idSekarang = new Set(data.map(d => d.no_id_pelanggan));
                daftarMenungguSebelumnya.forEach(id => {
                    if (!idSekarang.has(id)) daftarMenungguSebelumnya.delete(id);
                });
                cekPertamaKali = false;
            }
        } catch (e) {}
    }, 4000);
}

// ==========================================
// FITUR 1: VALIDASI TRANSFER (TANPA KAMERA - KARENA PELANGGAN SUDAH UPLOAD)
// ==========================================
async function konfirmasiLunasTransfer(idPel, nama) {
    if (!confirm(`Validasi bukti transfer dari ${nama} dan nyatakan LUNAS?`)) return;

    try {
        // 1. Update status di tabel pelanggan (TAMBAHAN: narik alamat juga)
        const { data: dataPel, error } = await supabaseClient
            .from('pelanggan')
            .update({ status_bayar: 'Lunas', status: 'Aktif' })
            .eq('no_id_pelanggan', idPel)
            .select('abonemen, bukti_bayar_url, alamat'); 

        if (error) throw error;

        // Ambil nominal tagihan, url foto, dan alamat
        const jumlahTagihan = (dataPel && dataPel.length > 0) ? dataPel[0].abonemen : 0;
        const urlBukti = (dataPel && dataPel.length > 0) ? dataPel[0].bukti_bayar_url : null;
        const alamatPelanggan = (dataPel && dataPel.length > 0) ? dataPel[0].alamat : '-';

        // 2. Catat otomatis ke gudang riwayat (tabel tagihan)
        const tglSekarang = new Date();
        const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const periodeBulanIni = `${namaBulan[tglSekarang.getMonth()]} ${tglSekarang.getFullYear()}`;
        const nomorKwitansiUnik = idPel;

        const { error: errTagihan } = await supabaseClient
            .from('tagihan')
            .insert([
                {
                    pelanggan_id: idPel,
                    nama_pelanggan: nama,                 // KODE BARU DIMASUKKAN
                    alamat_pelanggan: alamatPelanggan,    // KODE BARU DIMASUKKAN
                    no_kwitansi: nomorKwitansiUnik,
                    periode_bulan: periodeBulanIni,
                    jumlah_tagihan: jumlahTagihan,
                    status_bayar: 'Lunas',
                    bukti_bayar_url: urlBukti,
                    metode_pembayaran: 'Transfer',
                    tgl_lunas: new Date(tglSekarang.getTime() - (tglSekarang.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').substring(0, 19)
                }
            ]);

        if (errTagihan) console.error("Gagal nyatat ke tabel tagihan:", errTagihan);

        alert(`Mantap! Pembayaran Transfer dari ${nama} resmi divalidasi LUNAS dan masuk ke Riwayat Tagihan!`);
        catatLog(`Memvalidasi lunas transfer untuk pelanggan ${nama}`);
        ambilDataPembayaran();
        if(typeof renderGrafik === "function") renderGrafik();
    } catch (err) {
        alert('Gagal mengonfirmasi lunas: ' + err.message);
    }
}

// ==========================================
// FITUR 2: TERIMA UANG TUNAI + FOTO BUKTI ADMIN (UNTUK STATUS BELUM BAYAR)
// ==========================================
function konfirmasiLunasCash(idPel, nama) {
    document.getElementById('lunas_id_pelanggan').value = idPel;
    document.getElementById('lunas_nama_pelanggan').innerText = nama;
    document.getElementById('foto_bukti_admin').value = ""; 
    document.getElementById('modal-lunas-admin').style.display = 'flex';
}

async function prosesLunasAdmin(event) {
    event.preventDefault();
    const btnSimpan = event.target.querySelector('button[type="submit"]');
    btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
    btnSimpan.disabled = true;

    const idPel = document.getElementById('lunas_id_pelanggan').value;
    const nama = document.getElementById('lunas_nama_pelanggan').innerText;
    const fileInput = document.getElementById('foto_bukti_admin');
    const file = fileInput.files[0];
    let fotoUrl = null;

    try {
        // 1. Upload foto uang/kuitansi
        if (file) {
            const ext = file.name.split('.').pop();
            const fileName = `adm-cash-${idPel}-${Date.now()}.${ext}`;

            const { error: upErr } = await supabaseClient.storage.from('bukti_bayar').upload(fileName, file);
            if (upErr) throw upErr;

            const { data: urlData } = supabaseClient.storage.from('bukti_bayar').getPublicUrl(fileName);
            fotoUrl = urlData.publicUrl;
        }

        // 2. Ubah status di database jadi Lunas (TAMBAHAN: narik alamat juga)
        const { data: dataPel, error: dbErr } = await supabaseClient
            .from('pelanggan')
            .update({ 
                status_bayar: 'Lunas', 
                status: 'Aktif',
                bukti_bayar_url: fotoUrl 
            })
            .eq('no_id_pelanggan', idPel)
            .select('abonemen, alamat');

        if (dbErr) throw dbErr;

        const jumlahTagihan = (dataPel && dataPel.length > 0) ? dataPel[0].abonemen : 0;
        const alamatPelanggan = (dataPel && dataPel.length > 0) ? dataPel[0].alamat : '-';

        // 3. Catat ke tabel tagihan
        const tglSekarang = new Date();
        const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const periodeBulanIni = `${namaBulan[tglSekarang.getMonth()]} ${tglSekarang.getFullYear()}`;
        const nomorKwitansiUnik = idPel;

        const { error: errTagihan } = await supabaseClient
            .from('tagihan')
            .insert([
                {
                    pelanggan_id: idPel,
                    nama_pelanggan: nama,                 // KODE BARU DIMASUKKAN
                    alamat_pelanggan: alamatPelanggan,    // KODE BARU DIMASUKKAN
                    no_kwitansi: nomorKwitansiUnik,
                    periode_bulan: periodeBulanIni,
                    jumlah_tagihan: jumlahTagihan,
                    status_bayar: 'Lunas',
                    bukti_bayar_url: fotoUrl,
                    metode_pembayaran: 'Tunai',
                    tgl_lunas: new Date(tglSekarang.getTime() - (tglSekarang.getTimezoneOffset() * 60000)).toISOString().replace('T', ' ').substring(0, 19)
                }
            ]);
            
        if (errTagihan) console.error("Gagal nyatat ke tabel tagihan:", errTagihan);

        alert(`Mantap Bos! Pembayaran Tunai dari ${nama} berhasil dicatat dan masuk ke Riwayat Tagihan!`);
        catatLog(`Menerima pembayaran tunai LUNAS dari ${nama}`);
        document.getElementById('modal-lunas-admin').style.display = 'none';
        ambilDataPembayaran(); 
        if(typeof renderGrafik === "function") renderGrafik();

    } catch (err) {
        alert('Gagal mengonfirmasi lunas: ' + err.message);
    } finally {
        btnSimpan.innerHTML = '<i class="fa-solid fa-check-double"></i> Simpan & Lunas';
        btnSimpan.disabled = false;
    }
}

// ==========================================
// FITUR EDIT DATA PELANGGAN (TIMPA DATA LAMA)
// ==========================================
async function bukaEditPelanggan(idPel) {
    document.getElementById('modal-edit').style.display = 'flex';
    
    // Ambil data pelanggan saat ini dari database
    const { data } = await supabaseClient.from('pelanggan').select('*').eq('no_id_pelanggan', idPel).single();
    
    if(data) {
        document.getElementById('edit_id_pelanggan').value = data.no_id_pelanggan;
        document.getElementById('edit_nama').value = data.nama_lengkap || '';
        document.getElementById('edit_ktp').value = data.no_ktp || '';
        document.getElementById('edit_hp').value = data.no_hp || '';
        document.getElementById('edit_pppoe').value = data.user_pppoe || '';
        document.getElementById('edit_abonemen').value = data.abonemen || '';
        document.getElementById('edit_tgl_penarikan').value = data.tgl_penarikan || '';
        document.getElementById('edit_psb').value = data.tgl_psb || '';
        document.getElementById('edit_alamat').value = data.alamat || '';
        document.getElementById('edit_koordinat').value = data.titik_koordinat || '';
        document.getElementById('edit_catatan').value = data.catatan_tambahan || '';
        
        // Memunculkan foto KTP lama di form edit
        const previewKtp = document.getElementById('preview_edit_ktp');
        if (data.foto_ktp_url) {
            previewKtp.src = data.foto_ktp_url;
            previewKtp.style.display = 'block';
        } else {
            previewKtp.style.display = 'none';
        }
    }
}

async function simpanEditPelanggan(event) {
    event.preventDefault();
    const btnSimpan = event.target.querySelector('button[type="submit"]');
    btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btnSimpan.disabled = true;
    
    const idPel = document.getElementById('edit_id_pelanggan').value;
    
    // Siapkan data komplit yang akan ditimpa ke database
    let dataUpdate = {
        nama_lengkap: document.getElementById('edit_nama').value,
        no_ktp: document.getElementById('edit_ktp').value,
        no_hp: document.getElementById('edit_hp').value,
        user_pppoe: document.getElementById('edit_pppoe').value,
        abonemen: parseInt(document.getElementById('edit_abonemen').value),
        tgl_penarikan: parseInt(document.getElementById('edit_tgl_penarikan').value),
        tgl_psb: document.getElementById('edit_psb').value,
        alamat: document.getElementById('edit_alamat').value,
        titik_koordinat: document.getElementById('edit_koordinat').value,
        catatan_tambahan: document.getElementById('edit_catatan').value
    };

    try {
        // Cek jika ada foto KTP baru yang diupload
        const fileInput = document.getElementById('edit_foto_ktp');
        const file = fileInput.files[0];
        
        if (file) {
            btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Upload Foto...';
            const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const fileName = `ktp-${idPel}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage.from('foto_ktp').upload(fileName, file);
            if (uploadError) throw uploadError;
            
            const { data: publicUrlData } = supabaseClient.storage.from('foto_ktp').getPublicUrl(fileName);
            dataUpdate.foto_ktp_url = publicUrlData.publicUrl;
        }

        const { error } = await supabaseClient.from('pelanggan').update(dataUpdate).eq('no_id_pelanggan', idPel);
        if (error) throw error;
        
        alert('Mantap Bos! Data berhasil diperbarui (ditimpa)!');
        catatLog(`Mengedit data pelanggan ID: ${idPel}`);
        document.getElementById('modal-edit').style.display = 'none';
        ambilDataPelanggan(); // Refresh tabel
    } catch (err) {
        alert('Gagal edit data: ' + err.message);
    } finally {
        btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Timpa & Simpan';
        btnSimpan.disabled = false;
    }
}



// ==========================================
// FITUR RESET MASSAL PER RUTE TANGGAL (BULAN BARU)
// ==========================================
async function resetMassalBulanBaru() {
    const filterTgl = document.getElementById('filter-tgl-bayar').value;
    
    // Cegah Admin pencet tombol kalau filternya masih "Semua Rute Tanggal"
    if (filterTgl === 'semua') {
        alert('Pilih Rute Tanggal dulu di kotak filter Bosku! (Misal: Rute Tanggal 1).\n\nBahaya kalau nggak sengaja ke-reset semua se-kabupaten! 😂');
        return;
    }

    const konfirmasi = confirm(`🚨 AWAS BULAN BARU!\n\nYakin ingin mereset SEMUA tagihan pelanggan di Rute Tanggal ${filterTgl} menjadi "Belum Bayar" lagi?\n\n(Foto bukti bayar bulan lalu juga otomatis akan dibersihkan)`);
    
    if (!konfirmasi) return;

    try {
        // Tampilkan loading di tabel saat proses reset
        const tbody = document.getElementById('tabel-body-pembayaran');
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Sedang mereset data rute ini...</td></tr>';

        // Proses Update ke Supabase
        const { error } = await supabaseClient
            .from('pelanggan')
            .update({ status_bayar: 'Belum Bayar', bukti_bayar_url: null })
            .eq('tgl_penarikan', parseInt(filterTgl)); // Hanya reset tanggal yang dipilih

        if (error) throw error;

        alert(`MANTAP BOS! Semua tagihan rute Tanggal ${filterTgl} sudah di-reset menjadi merah, siap ditagih untuk bulan ini!`);
        catatLog(`Melakukan RESET MASSAL tagihan untuk seluruh rute Tanggal ${filterTgl}`);
        ambilDataPembayaran(); // Refresh tabel otomatis
        
    } catch (err) {
        alert('Gagal reset massal: ' + err.message);
        ambilDataPembayaran(); // Kembalikan tabel jika gagal
    }
}



// ==========================================
// FITUR RESET INDIVIDU (MANUAL PER ORANG)
// ==========================================
async function resetTagihanBulanBaru(idPel) {
    const konfirmasi = confirm(`Yakin ingin mereset pelanggan ini menjadi "Belum Bayar"?\n(Bukti transfer bulan lalunya juga akan dibersihkan dari database)`);
    if (!konfirmasi) return;

    try {
        const { error } = await supabaseClient
            .from('pelanggan')
            .update({ status_bayar: 'Belum Bayar', bukti_bayar_url: null })
            .eq('no_id_pelanggan', idPel);

        if (error) throw error;

        alert('Berhasil! Tagihan pelanggan tersebut sudah di-reset menjadi Belum Bayar.');
        catatLog(`Mereset tagihan ID ${idPel} menjadi Belum Bayar (Bulan Baru)`);
        ambilDataPembayaran(); // Refresh tabel
    } catch (err) {
        alert('Gagal mereset pelanggan: ' + err.message);
    }
}



// ==========================================
// FITUR PENGATURAN REKENING & QRIS
// ==========================================
async function simpanPengaturan(event) {
    event.preventDefault();
    const btnSimpan = event.target.querySelector('button[type="submit"]');
    btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btnSimpan.disabled = true;

    try {
        const dana = document.getElementById('set_dana').value;
        const bca = document.getElementById('set_bca').value;
        const bri = document.getElementById('set_bri').value;
        const mandiri = document.getElementById('set_mandiri').value;
        
        const fileQris = document.getElementById('set_qris').files[0];
        let urlQris = null;

        // Jika Admin upload gambar QRIS baru
        if (fileQris) {
            if (!validasiBerkas(fileQris, 3, ['jpg', 'jpeg', 'png', 'webp'])) {
                btnSimpan.innerHTML = 'Simpan Pengaturan';
                btnSimpan.disabled = false;
                return;
            }
            const ext = (fileQris.name.split('.').pop() || 'png').toLowerCase();
            const fileName = `qris-utama.${ext}`; // Nama file ditimpa biar bersih

            const { error: upErr } = await supabaseClient.storage.from('qris').upload(fileName, fileQris, { upsert: true });
            if (upErr) throw upErr;

            const { data: urlData } = supabaseClient.storage.from('qris').getPublicUrl(fileName);
            // Tambahkan timestamp agar gambar selalu refresh di browser
            urlQris = `${urlData.publicUrl}?t=${Date.now()}`; 
        }

        // Siapkan data yang mau di-update
        let dataUpdate = {
            no_dana: dana,
            no_bca: bca,
            no_bri: bri,
            no_mandiri: mandiri
        };

        // Masukkan URL QRIS ke dataUpdate HANYA JIKA ada file yang diupload
        if (urlQris) {
            dataUpdate.qris_url = urlQris;
        }

        // Update ke Supabase (ID pasti 1 karena kita cuma pakai 1 baris untuk setting toko)
        const { error: updateErr } = await supabaseClient
            .from('pengaturan_pembayaran')
            .update(dataUpdate)
            .eq('id', 1);

        if (updateErr) throw updateErr;

        alert('Mantap! Pengaturan Rekening dan QRIS berhasil diperbarui!');
    } catch (error) {
        alert('Gagal menyimpan pengaturan: ' + error.message);
        console.error(error);
    } finally {
        btnSimpan.innerHTML = 'Simpan Pengaturan';
        btnSimpan.disabled = false;
    }
}



// ==========================================
// FITUR MANAJEMEN AKUN KARYAWAN
// ==========================================
async function ambilDataUser() {
    const tbody = document.getElementById('tabel-body-user');
    if(!tbody) return;
    
    try {
        // Hanya ambil kolom yang memang ditampilkan (kolom password tidak ikut ditarik)
        const { data, error } = await supabaseClient
            .from('akun_user')
            .select('id, nama_lengkap, username, role')
            .order('id', { ascending: true });
        if (error) throw error;
        
        tbody.innerHTML = '';
        let barisUser = '';

        data.forEach((u) => {
            // Password tidak lagi ditampilkan/ditarik ke browser
            const passTampil = '••••••';

            // Tombol hapus cuma buat Karyawan, Admin ga bisa dihapus sembarangan
            const btnHapus = u.role === 'Admin' ? 
                `<span style="color:var(--text-muted); font-size:11px;">Admin Paten</span>` : 
                `<button class="btn-location" style="background: var(--danger); padding: 4px 10px; font-size: 11px; color: white; border: none;" onclick="hapusAkunUser(${Number(u.id) || 0})"><i class="fa-solid fa-trash"></i></button>`;

            barisUser += `
                <tr>
                    <td><strong>${esc(u.nama_lengkap)}</strong> <br><small style="color:var(--primary); font-weight:bold;">${esc(u.role)}</small></td>
                    <td>${esc(u.username)}</td>
                    <td>${passTampil}</td>
                    <td>${btnHapus}</td>
                </tr>
            `;
        });

        tbody.innerHTML = barisUser;
    } catch (err) {
        console.error('Gagal memuat user:', err);
    }
}

async function simpanAkunUser(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    
    try {
        const namaKaryawan = document.getElementById('user_nama').value.trim();
        const usernameKaryawan = document.getElementById('user_username').value.trim();
        const passwordKaryawan = document.getElementById('user_password').value;

        // Validasi sederhana supaya data akun tidak masuk dalam kondisi rusak
        if (!namaKaryawan) throw new Error('Nama lengkap wajib diisi.');
        if (!/^[a-zA-Z0-9._-]{3,32}$/.test(usernameKaryawan)) {
            throw new Error('Username hanya boleh huruf, angka, titik, garis bawah, atau strip (3-32 karakter, tanpa spasi).');
        }
        if (passwordKaryawan.length < 6) {
            throw new Error('Password minimal 6 karakter.');
        }

        const { error } = await supabaseClient.from('akun_user').insert([{
            nama_lengkap: namaKaryawan,
            username: usernameKaryawan,
            password: passwordKaryawan,
            role: 'Karyawan'
        }]);
        
        if (error) {
            if(error.code === '23505') throw new Error("Username sudah dipakai, silakan cari nama username lain!");
            throw error;
        }
        
        alert('Mantap Bos! Akun Karyawan berhasil dibuat.');
        event.target.reset();
        ambilDataUser(); // Refresh tabel
    } catch (err) {
        alert('Gagal membuat akun: ' + err.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Buat Akun';
        btn.disabled = false;
    }
}

async function hapusAkunUser(id) {
    if(!confirm('Yakin ingin memecat/menghapus akun pekerja ini?')) return;
    try {
        const { error } = await supabaseClient.from('akun_user').delete().eq('id', id);
        if (error) throw error;
        alert('Akun berhasil dihapus!');
        ambilDataUser();
    } catch(err) {
        alert('Gagal menghapus: ' + err.message);
    }
}
// ==========================================
// 15. FITUR EXPORT DATA PELANGGAN KE CSV (PLUS TANGGAL & PERIODE LUNAS)
// ==========================================
async function exportDataCSV(filterStatus) {
    try {
        // 1. Ambil data pelanggan dari Supabase
        let query = supabaseClient.from('pelanggan').select('*');
        
        if (filterStatus !== 'Semua') {
            query = query.eq('status', filterStatus);
        }

        const { data: dataPelanggan, error: errPel } = await query.order('nama_lengkap', { ascending: true });
        
        if (errPel) throw errPel;
        if (!dataPelanggan || dataPelanggan.length === 0) {
            alert(`Tidak ada data pelanggan untuk kategori: ${filterStatus}`);
            return;
        }

        // 2. Ambil riwayat pembayaran dari tabel 'tagihan' untuk mencari Tanggal & Bulan Lunas
        const { data: dataTagihan, error: errTag } = await supabaseClient
            .from('tagihan')
            .select('pelanggan_id, tgl_lunas, periode_bulan, metode_pembayaran')
            .order('tgl_lunas', { ascending: false });

        // Kelompokkan tagihan terbaru berdasarkan ID Pelanggan
        const mapTagihanTerbaru = {};
        if (!errTag && dataTagihan) {
            dataTagihan.forEach(t => {
                // Karena sudah diurutkan dari yang terbaru, ambil yang pertama kali muncul saja
                if (!mapTagihanTerbaru[t.pelanggan_id]) {
                    mapTagihanTerbaru[t.pelanggan_id] = t;
                }
            });
        }

        // JURUS ANTI NUMPUK DI EXCEL INDONESIA
        let csvContent = "sep=;\n";
        
        // Buat Header Kolom (Ditambah Periode Tagihan, Waktu Lunas, & Metode)
        csvContent += "No;ID Pelanggan;Nama Lengkap;No HP;Alamat;User PPPoE;Abonemen;Tgl Penarikan;Status Akun;Status Bayar;Periode Lunas;Tanggal & Jam Lunas;Metode Bayar\n";

        // 3. Gabungkan Data Pelanggan & Data Tanggal Lunas
        dataPelanggan.forEach((p, index) => {
            const nama = csvAman((p.nama_lengkap || '').replace(/;/g, ' '));
            const hp = p.no_hp ? `="${String(p.no_hp).replace(/"/g, '')}"` : '-'; 
            const alamat = csvAman((p.alamat || '-').replace(/;/g, ' ').replace(/\n/g, ' '));
            const pppoe = csvAman((p.user_pppoe || '-').replace(/;/g, ' '));
            const abonemen = Number(p.abonemen) || 0;
            const stBayar = p.status_bayar || 'Belum Bayar';
            
            // Cek apakah statusnya Lunas dan ada catatannya di tabel tagihan
            let periodeLunas = '-';
            let waktuLunas = '-';
            let metodeBayar = '-';

            if (stBayar === 'Lunas' && mapTagihanTerbaru[p.no_id_pelanggan]) {
                const infoTgh = mapTagihanTerbaru[p.no_id_pelanggan];
                periodeLunas = csvAman(infoTgh.periode_bulan || '-');
                waktuLunas = infoTgh.tgl_lunas ? `="${String(infoTgh.tgl_lunas).replace(/"/g, '')}"` : '-';
                metodeBayar = csvAman(infoTgh.metode_pembayaran || '-');
            } else if (stBayar === 'Lunas') {
                periodeLunas = 'Lunas (Data Lama)';
            }
            
            csvContent += `${index + 1};${p.no_id_pelanggan};${nama};${hp};${alamat};${pppoe};${abonemen};${p.tgl_penarikan || '-'};${p.status};${stBayar};${periodeLunas};${waktuLunas};${metodeBayar}\n`;
        });

        // 4. Proses Download File Otomatis
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Data_Pelanggan_KDM_${filterStatus}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`Mantap! Data pelanggan (${filterStatus}) beserta Tanggal Lunasnya berhasil diunduh!`);
    } catch (err) {
        console.error('Gagal export CSV:', err);
        alert('Terjadi kesalahan saat mengunduh data: ' + err.message);
    }
}

// ==========================================
// 16. FITUR LIVE SEARCH (PENYARING TABEL OTOMATIS)
// ==========================================
function saringTabel(idInput, idTbody) {
    const inputEl = document.getElementById(idInput);
    const tbody = document.getElementById(idTbody);
    if (!inputEl || !tbody) return;

    const kataKunci = inputEl.value.toLowerCase().trim();
    const baris = tbody.getElementsByTagName('tr');

    for (let i = 0; i < baris.length; i++) {
        if (baris[i].cells.length <= 1) continue;

        const teksBaris = baris[i].textContent.toLowerCase();
        if (teksBaris.includes(kataKunci)) {
            baris[i].style.display = '';
        } else {
            baris[i].style.display = 'none';
        }
    }
}
// Pendaftaran PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('PWA Berhasil Didaftarkan!'))
            .catch(err => console.log('PWA Gagal:', err));
    });
}

// ==========================================
// 17. FITUR EXPORT REKAP PEMBAYARAN (DARI TABEL TAGIHAN)
// ==========================================
async function exportTagihanCSV() {
    try {
        // Ambil riwayat uang masuk dari tabel tagihan
        const { data, error } = await supabaseClient
            .from('tagihan')
            .select('*')
            .order('tgl_lunas', { ascending: false }); // Urutkan dari yang terbaru
        
        if (error) throw error;
        if (!data || data.length === 0) {
            alert('Belum ada data rekap pembayaran tagihan di sistem.');
            return;
        }

        // JURUS ANTI NUMPUK DI EXCEL INDONESIA
        let csvContent = "sep=;\n";
        
        // Buat Header Kolom Khusus Pembayaran
        csvContent += "No;No Kwitansi (ID);Nama Pelanggan;Alamat;Periode Bulan;Nominal (Rp);Metode Bayar;Tanggal & Jam Lunas\n";

        // Isi Data dari database tagihan
        data.forEach((t, index) => {
            const nama = csvAman((t.nama_pelanggan || '-').replace(/;/g, ' '));
            const alamat = csvAman((t.alamat_pelanggan || '-').replace(/;/g, ' ').replace(/\n/g, ' '));
            const nominal = Number(t.jumlah_tagihan) || 0;
            const periode = csvAman(t.periode_bulan || '-');
            const metode = csvAman(t.metode_pembayaran || '-');
            const waktuLunas = t.tgl_lunas ? `="${String(t.tgl_lunas).replace(/"/g, '')}"` : '-';
            
            csvContent += `${index + 1};${t.no_kwitansi || '-'};${nama};${alamat};${periode};${nominal};${metode};${waktuLunas}\n`;
        });

        // Proses Download File Otomatis
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Rekap_Pembayaran_KDM_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Mantap! Data Rekap Pembayaran berhasil diunduh.');
    } catch (err) {
        console.error('Gagal export CSV Tagihan:', err);
        alert('Terjadi kesalahan saat mengunduh data pembayaran: ' + err.message);
    }
}


// ==========================================
// 18. FUNGSI DOWNLOAD E-NOTA (MESIN VIRTUAL ANTI-GENCET)
// ==========================================
function unduhENotaJPG() {
    const btnDownload = document.getElementById('btn-download-nota');
    const notifSukses = document.getElementById('notif-download-sukses');
    const data = window.dataTagihanAktif; // Ambil data dari global

    if (!data) return alert("Data tagihan tidak ditemukan!");

    btnDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Nota Resmi...';
    btnDownload.disabled = true;

    // Siapkan Teks (di-escape supaya aman ditampilkan ke HTML)
    const pppoe = esc(data.user_pppoe || '-');
    const alamat = esc(data.alamat || '-');
    const namaPelanggan = esc(data.nama_lengkap || '-');
    const idPelangganTampil = esc(data.no_id_pelanggan || '-');
    const tglTagih = esc(data.tgl_penarikan || '-');
    const nominalTagihan = Number(data.abonemen) || 0;
    const noHp = esc(data.no_hp || '-');
    const tglPsb = data.tgl_psb || '';
    const rupiah = nominalTagihan.toLocaleString('id-ID');
    const teksTerbilang = (nominalTagihan > 0 ? terbilang(nominalTagihan) : "Nol") + " Rupiah";
    
    const d = new Date();
    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const tglNota = tglTagih + " " + namaBulan[d.getMonth()] + " " + d.getFullYear();
    const periodeTagihan = "Abonemen internet bulan " + namaBulan[d.getMonth()] + " " + d.getFullYear();
    const tglPrintFull = `${String(d.getDate()).padStart(2, '0')} ${namaBulan[d.getMonth()]} ${d.getFullYear()}, Pukul ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    let formatTglPsb = "-";
    if (tglPsb && tglPsb !== 'null' && tglPsb !== '') {
        const psbDate = new Date(tglPsb);
        if (!isNaN(psbDate.getTime())) formatTglPsb = `${String(psbDate.getDate()).padStart(2, '0')} ${namaBulan[psbDate.getMonth()]} ${psbDate.getFullYear()}`;
    }

    // BUAT LAYAR VIRTUAL RAKSASA DI LUAR HP
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '0';
    tempContainer.style.width = '800px'; 
    tempContainer.style.zIndex = '-999';

    // RAKIT NOTA DENGAN FLEXBOX KAKU
    tempContainer.innerHTML = `
        <div id="target-foto-nota" style="width: 800px; background: white; color: black; font-family: Arial, sans-serif; padding: 40px; box-sizing: border-box; position: relative;">
            
            <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 130px; color: rgba(0, 255, 209, 0.15); font-weight: 900; border: 10px solid rgba(0, 255, 209, 0.15); padding: 10px 40px; border-radius: 20px; z-index: 1;">LUNAS</div>
            
            <div style="position: relative; z-index: 2;">
                <!-- KOP -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px double #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="width: 150px; text-align: center;">
                        <img src="logo.png" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: 5px;"><br>
                        <span style="font-size: 16px; font-weight: bold;">KDM Network</span><br>
                        <span style="font-size: 11px;">Network Installation</span>
                    </div>
                    <div style="width: 400px; text-align: center;">
                        <h1 style="margin: 0; font-size: 38px; font-weight: bold; line-height: 1;">KDM Network</h1>
                        <div style="margin: 8px 0; font-size: 16px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 10px; display: inline-block;">Network Installation & Payment point</div><br>
                        <span style="font-size: 13px;">Office : Dsn. Krajan RT. 05 RW 03, Ds. Kedemungan</span>
                    </div>
                    <div style="width: 170px; text-align: right; font-size: 13px; font-weight: bold; line-height: 1.5;">
                        Customer Care :<br>0851-3683-8577<br>
                        Teknisi Lokal :<br>0878-4451-1830
                    </div>
                </div>

                <!-- NOMOR -->
                <div style="display: flex; justify-content: flex-end; font-size: 16px; font-weight: bold; margin-bottom: 25px;">
                    <div style="width: 350px;">
                        <div style="display: flex; margin-bottom: 5px;"><div style="width: 120px;">No. Kwitansi</div><div>: ${idPelangganTampil}</div></div>
                        <div style="display: flex;"><div style="width: 120px;">Tanggal</div><div>: ${tglNota}</div></div>
                    </div>
                </div>

                <!-- RINCIAN -->
                <div style="font-size: 17px; margin-bottom: 30px;">
                    <div style="display: flex; margin-bottom: 8px;"><div style="width: 180px;">Terima dari</div><div style="width: 20px;">:</div><div style="flex: 1; font-weight: bold;">${namaPelanggan}</div></div>
                    <div style="display: flex; margin-bottom: 8px;"><div style="width: 180px;">Alamat</div><div style="width: 20px;">:</div><div style="flex: 1;">${alamat}</div></div>
                    <div style="display: flex; margin-bottom: 8px;"><div style="width: 180px;">Untuk Pembayaran</div><div style="width: 20px;">:</div><div style="flex: 1;">${periodeTagihan}</div></div>
                    <div style="display: flex; margin-bottom: 8px;">
                        <div style="width: 180px;">Tagihan</div><div style="width: 20px;">:</div><div style="width: 40px;">Rp.</div><div style="width: 180px;">${rupiah}</div>
                        <div style="width: 100px;">Nomer Hp</div><div style="width: 20px;">:</div><div style="flex: 1;">${noHp}</div>
                    </div>
                    <div style="display: flex; margin-bottom: 8px;">
                        <div style="width: 180px;">Lain-lain</div><div style="width: 20px;">:</div><div style="width: 40px;">Rp.</div><div style="width: 180px;">-</div>
                        <div style="width: 100px;">User</div><div style="width: 20px;">:</div><div style="flex: 1;">${pppoe}</div>
                    </div>
                    <div style="display: flex; margin-bottom: 8px;"><div style="width: 180px;">Jumlah</div><div style="width: 20px;">:</div><div style="width: 40px;">Rp.</div><div style="flex: 1; font-weight: bold;">${rupiah}</div></div>
                    
                    <div style="display: flex; align-items: center; margin-top: 20px;">
                        <div style="width: 180px;">Terbilang</div><div style="width: 20px;">:</div>
                        <div style="flex: 1;"><div style="background-color: #e5e7eb; padding: 10px 15px; font-style: italic; font-weight: bold; display: inline-block;"># ${teksTerbilang} #</div></div>
                    </div>
                </div>

                <!-- TTD -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px;">
                    <div style="width: 35%; border: 2px solid #000; padding: 15px; line-height: 1.4;">
                        <div style="font-style:italic; margin-bottom: 5px;">Bisa dibayarkan ke</div>
                        <div style="font-size: 16px; font-weight: bold;">Mandiri 144-00-20258650</div>
                        <div style="font-style:italic; font-size: 14px;">a.n : Ferry Andhi Setiawan</div>
                        <div style="font-size: 16px; font-weight: bold; margin-top: 8px;">BCA 8945106928</div>
                        <div style="font-style:italic; font-size: 14px;">a.n : Yunita</div>
                    </div>
                    <div style="width: 30%; text-align: center;">
                        <div style="margin-bottom: 70px;">Petugas</div>
                        <div style="border-bottom: 2px solid #000; width: 80%; margin: 0 auto;"></div>
                    </div>
                    <div style="width: 30%; text-align: center;">
                        <div style="margin-bottom: 10px;">Pasuruan, ${tglNota}</div>
                        <div style="margin-bottom: 45px;">Customer</div>
                        <div style="font-weight: bold; font-size: 16px;">${namaPelanggan}</div>
                        <div style="border-bottom: 2px solid #000; width: 80%; margin: 0 auto;"></div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; font-family: monospace;">
                    <div>Printed &nbsp;: ${tglPrintFull}<br>PSB &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${formatTglPsb}</div>
                    <div style="font-style: italic; font-family: 'Times New Roman', serif; text-align: right;">Powered by PT.Data Buana Nusantara</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(tempContainer);

    // Eksekusi Kamera (Kasih waktu 0.5 detik agar mesin menggambar sempurna)
    setTimeout(() => {
        html2canvas(document.getElementById('target-foto-nota'), { scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = `E-Nota_Lunas_KDM_${String(data.no_id_pelanggan || '').replace(/[^A-Za-z0-9_-]/g, '')}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();

            btnDownload.style.display = 'none';
            notifSukses.style.display = 'block';
            
            // Hapus mesin virtual agar tidak menumpuk di web
            document.body.removeChild(tempContainer);
        }).catch(err => {
            alert('Gagal menyimpan nota: ' + err.message);
            btnDownload.innerHTML = '<i class="fa-solid fa-download"></i> Unduh E-Nota Resmi (JPG)';
            btnDownload.disabled = false;
            document.body.removeChild(tempContainer);
        });
    }, 500); 
}


// ==========================================
// 19. FUNGSI PENGATURAN INTEGRASI MIKROTIK
// ==========================================
async function ambilDataMikrotik() {
    try {
        const { data, error } = await supabaseClient.from('pengaturan_pembayaran').select('mk_ip, mk_port, mk_user, mk_pass').eq('id', 1).single();
        if (data) {
            if(document.getElementById('set_mk_ip')) document.getElementById('set_mk_ip').value = data.mk_ip || '';
            if(document.getElementById('set_mk_port')) document.getElementById('set_mk_port').value = data.mk_port || '8728';
            if(document.getElementById('set_mk_user')) document.getElementById('set_mk_user').value = data.mk_user || '';
            if(document.getElementById('set_mk_pass')) document.getElementById('set_mk_pass').value = data.mk_pass || '';
        }
    } catch (err) {
        console.error('Gagal memuat pengaturan mikrotik:', err);
    }
}

async function simpanPengaturanMikrotik(event) {
    event.preventDefault();
    const btnSimpan = event.target.querySelector('button[type="submit"]');
    const teksLama = btnSimpan.innerHTML;
    btnSimpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btnSimpan.disabled = true;

    try {
        const dataUpdate = {
            mk_ip: document.getElementById('set_mk_ip').value,
            mk_port: document.getElementById('set_mk_port').value,
            mk_user: document.getElementById('set_mk_user').value,
            mk_pass: document.getElementById('set_mk_pass').value
        };

        const { error } = await supabaseClient.from('pengaturan_pembayaran').update(dataUpdate).eq('id', 1);
        if (error) throw error;

        alert('Mantap Bos! Data koneksi API Mikrotik berhasil diamankan di brankas Supabase!');
    } catch (error) {
        alert('Gagal menyimpan: ' + error.message);
    } finally {
        btnSimpan.innerHTML = teksLama;
        btnSimpan.disabled = false;
    }
}


// ==========================================
// 20. FUNGSI EKSEKUSI API MIKROTIK (MEMANGGIL ROBOT SUPABASE)
// ==========================================
async function eksekusiMikrotik(pppoeUser, aksi) {
    try {
        console.log(`Memanggil Robot Supabase untuk ${aksi} pelanggan: ${pppoeUser}...`);

       const { data, error } = await supabaseClient.functions.invoke('isolir-kdm', {
    body: { pppoe_user: pppoeUser, aksi: aksi }
});

        if (error) {
            throw new Error(error.message || "Robot gagal merespon.");
        }

        // Jika robot berhasil membalas
        alert(`🤖 [ROBOT SUPABASE BERHASIL!]\n\n${data.pesan}`);

    } catch (err) {
        console.error('Gagal memanggil robot Supabase:', err);
        alert('Gagal menyuruh Robot: ' + err.message);
    }
}


// ==========================================
// 21. FITUR CCTV (LOG AKTIVITAS) KHUSUS BOS
// ==========================================
async function catatLog(aksiKaryawan) {
    try {
        let elemenNama = document.getElementById('userNameDisplay').innerText;
        let namaPekerja = elemenNama.replace('Halo, ', '').replace('!', '').trim() || 'Sistem';

        await supabaseClient.from('log_aktivitas').insert([
            {
                nama_karyawan: namaPekerja,
                aksi: aksiKaryawan
            }
        ]);
    } catch (err) {
        console.error('CCTV Gagal mencatat:', err);
    }
}

async function ambilDataLog() {
    const tbody = document.getElementById('tabel-body-log');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Memutar ulang rekaman CCTV...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('log_aktivitas')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50); 

        if (error) throw error;
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Belum ada pergerakan atau aktivitas yang terekam.</td></tr>';
            return;
        }

        data.forEach(log => {
            const tr = document.createElement('tr');
            const tgl = new Date(log.created_at);
            const formatWaktu = tgl.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            tr.innerHTML = `
                <td style="font-size: 13px; color: var(--text-muted);">${esc(formatWaktu)}</td>
                <td style="font-weight: bold; color: var(--primary);"><i class="fa-solid fa-user-tag"></i> ${esc(log.nama_karyawan)}</td>
                <td>${esc(log.aksi)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--danger);">Gagal memutar rekaman: ${esc(err.message)}</td></tr>`;
    }
}

// ==========================================
// 22. LOGOUT AMAN (SESI SUPABASE BENAR-BENAR DIAKHIRI)
// ==========================================
async function keluarAplikasi() {
    try { await catatLog('Logout dari sistem aplikasi KDM Network'); } catch (e) {}

    try {
        await supabaseClient.auth.signOut(); // hapus token dari browser dan server
    } catch (e) {
        console.error('Gagal sign out:', e);
    }

    sesiAktif = false;
    jabatanAktif = '';
    try { sessionStorage.clear(); } catch (e) {}

    // Kembali ke halaman login tanpa menyisakan parameter di URL
    window.location.replace(window.location.pathname);
}

// ==========================================
// 23. PENGAWAS SESI
// ==========================================
// Jika sesi berakhir di tengah pemakaian (token kedaluwarsa / logout dari tab lain),
// halaman otomatis terkunci lagi.
supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') sesiAktif = false;
});