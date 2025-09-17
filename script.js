// Fungsi untuk "membongkar" token JWT dan membaca isinya
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Gagal mem-parsing token:', e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Bagian 1: Deklarasi Variabel & Elemen DOM ---
    const token = localStorage.getItem('authToken');
    const authStatusDiv = document.getElementById('auth-status');
    const mainContentDiv = document.getElementById('main-content');
    const studentForm = document.getElementById('student-form');
    const studentListDiv = document.getElementById('student-list');
    const mainTitle = document.getElementById('main-title');
    const submitButton = document.getElementById('submit-button');
    const uploadSection = document.getElementById('upload-section');
    const uploadForm = document.getElementById('upload-form');
    const uploadNote = document.querySelector('#upload-section .upload-note');

    let currentStudentData = null; // Menyimpan data siswa saat ini

    // --- Bagian 2: Penjaga Gerbang & Logout ---
    if (!token) {
        authStatusDiv.innerHTML = '<p>Anda belum login. Silakan <a href="login.html">masuk</a> untuk melanjutkan.</p>';
        return;
    }

    mainContentDiv.style.display = 'block';
    authStatusDiv.innerHTML = '<p>Anda sudah masuk. <button id="logout-button">Keluar</button></p>';
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });

    // --- Bagian 3: Fungsi Utama untuk Memuat Data Siswa ---
    const loadStudentData = async () => {
        studentListDiv.innerHTML = '<div class="loader"></div><p style="text-align: center;">Sedang memuat data...</p>';
        try {
            const response = await fetch('http://localhost:3001/api/siswa', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 404) { // KASUS: PENGGUNA BARU
                mainTitle.textContent = 'Formulir Pendaftaran Siswa Baru';
                studentForm.style.display = 'grid';
                studentListDiv.innerHTML = '<p>Anda belum mendaftarkan data siswa.</p>';
                uploadSection.style.display = 'none';
                
                // --- LOGIKA AUTO-FILL NAMA DENGAN DEBUGGING ---
                console.log("Mencoba auto-fill nama untuk pengguna baru.");
                const userData = parseJwt(token);
                console.log("Isi data dari token:", userData); // Baris ini akan menunjukkan isi tiket Anda

                if (userData && userData.nama) {
                    console.log("Nama ditemukan di token:", userData.nama);
                    document.getElementById('namaLengkap').value = userData.nama;
                } else {
                    console.log("Nama TIDAK ditemukan di dalam token.");
                }
                // --- AKHIR LOGIKA DEBUGGING ---
                return;
            }
            if (!response.ok) throw new Error('Gagal mengambil data siswa.');

            currentStudentData = await response.json(); // KASUS: DATA SISWA SUDAH ADA

            if (currentStudentData) {
                mainTitle.textContent = 'Data Pendaftaran Siswa';
                studentForm.style.display = 'none';
                
                let studentHTML = `
                    <div><strong>Nama Lengkap:</strong> ${currentStudentData.namaLengkap}</div>
                    <div><strong>NISN:</strong> ${currentStudentData.nisn || '<em>Belum diisi</em>'}</div>
                    <div><strong>TTL:</strong> ${currentStudentData.tempatLahir}, ${new Date(currentStudentData.tanggalLahir).toLocaleDateString('id-ID')}</div>
                    <div><strong>Alamat:</strong> ${currentStudentData.alamat}</div>
                    <div><strong>Status Pendaftaran:</strong> <span style="font-weight: bold;">${currentStudentData.status.replace(/_/g, ' ')}</span></div>
                `;

                if (currentStudentData.status !== 'SISWA_DITOLAK') {
                    studentHTML += `<button id="edit-button" class="btn-edit">Edit Data</button>`;
                }

                studentListDiv.innerHTML = studentHTML;
                
                if (currentStudentData.status === 'SISWA_DITERIMA') {
                    uploadSection.style.display = 'block';
                    uploadNote.style.display = 'none';
                    uploadForm.querySelectorAll('input, button').forEach(el => el.disabled = false);
                } else if (currentStudentData.status === 'SISWA_DITOLAK') {
                    uploadSection.style.display = 'block';
                    uploadNote.style.display = 'block';
                    uploadForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
                } else {
                    uploadSection.style.display = 'none';
                }

                if (document.getElementById('edit-button')) {
                    document.getElementById('edit-button').addEventListener('click', handleEditClick);
                }
            }
        } catch (error) {
            studentListDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    };
    
    // --- Bagian 4: Fungsi untuk Mode Edit ---
    const handleEditClick = () => {
        if (!currentStudentData) return;
        
        document.getElementById('namaLengkap').value = currentStudentData.namaLengkap;
        document.getElementById('nisn').value = currentStudentData.nisn || '';
        document.getElementById('tempatLahir').value = currentStudentData.tempatLahir;
        document.getElementById('tanggalLahir').value = new Date(currentStudentData.tanggalLahir).toISOString().split('T')[0];
        document.getElementById('alamat').value = currentStudentData.alamat;
        document.getElementById('sekolahAsal').value = currentStudentData.sekolahAsal;
        document.getElementById('namaOrangTua').value = currentStudentData.namaOrangTua;
        document.getElementById('nomorTelepon').value = currentStudentData.nomorTelepon;

        studentForm.style.display = 'grid';
        studentListDiv.style.display = 'none';
        uploadSection.style.display = 'none';
        mainTitle.textContent = 'Edit Data Pendaftaran';
        submitButton.textContent = 'Update Data';
    };

    // --- Bagian 5: Fungsi untuk Submit Form (Daftar & Update) ---
    studentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const isEditMode = submitButton.textContent === 'Update Data';
        const method = isEditMode ? 'PATCH' : 'POST';
        
        const formData = new FormData(studentForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('http://localhost:3001/api/siswa', {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Gagal menyimpan data.');

            alert(result.message || 'Data berhasil disimpan!');
            
            studentForm.style.display = 'none';
            studentListDiv.style.display = 'block';
            loadStudentData(); 
        } catch (error) {
            alert(`Terjadi kesalahan: ${error.message}`);
        }
    });

    // --- Bagian 6: Fungsi untuk Upload Berkas ---
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        const uploadButton = document.getElementById('upload-button');
        
        uploadButton.disabled = true;
        uploadButton.textContent = 'Mengunggah...';

        try {
            const response = await fetch('http://localhost:3001/api/siswa/upload-berkas', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Gagal mengunggah berkas.');
            
            alert(result.message);
            // Anda bisa menambahkan logika untuk menampilkan link file di sini jika perlu
        } catch (error) {
            alert(`Terjadi kesalahan: ${error.message}`);
        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Unggah Berkas';
        }
    });

    // --- Bagian 7: Panggil Fungsi Utama ---
    loadStudentData();
});

