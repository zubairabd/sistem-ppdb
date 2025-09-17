document.addEventListener('DOMContentLoaded', () => {
    const authStatusDiv = document.getElementById('auth-status');
    const adminContentDiv = document.getElementById('admin-content');
    const studentListBody = document.getElementById('student-list-body');
    const token = localStorage.getItem('authToken');
    
    // Elemen untuk pencarian dan popup
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const detailModal = document.getElementById('detail-modal');
    const modalContent = document.getElementById('modal-content'); // Area untuk mengisi detail
    const closeModalButton = document.querySelector('.close-button');

    const statusMap = {
        CALON_SISWA: 'Calon Siswa',
        SISWA_DITERIMA: 'Diterima',
        SISWA_DITOLAK: 'Ditolak'
    };

    // Fungsi utama untuk mengambil data siswa dari server
    const fetchStudents = async (searchTerm = '') => {
        if (!token) {
            authStatusDiv.innerHTML = '<p>Anda harus <a href="login.html">login</a> sebagai admin untuk mengakses halaman ini.</p>';
            return;
        }

        try {
            // Tambahkan parameter pencarian ke URL jika ada
            const url = `http://localhost:3001/api/admin/students${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                authStatusDiv.innerHTML = '<p>Akses ditolak. Halaman ini hanya untuk admin. <a href="index.html">Kembali ke beranda</a></p>';
                return;
            }
            if (!response.ok) throw new Error('Gagal mengambil data siswa.');
            
            authStatusDiv.innerHTML = '<p>Anda masuk sebagai admin. <button id="logout-button" style="background:none;border:none;color:#6366f1;text-decoration:underline;cursor:pointer;">Keluar</button></p>';
            document.getElementById('logout-button').addEventListener('click', () => {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
            });
            adminContentDiv.style.display = 'block';

            const students = await response.json();
            renderTable(students);

        } catch (error) {
            console.error(error);
            authStatusDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    };

    // Fungsi untuk menampilkan data ke dalam tabel
    const renderTable = (students) => {
        studentListBody.innerHTML = '';
        if (students.length === 0) {
            studentListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Data siswa tidak ditemukan.</td></tr>';
            return;
        }

        students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${student.namaLengkap}</td>
                <td>${student.nisn || '<em>N/A</em>'}</td>
                <td>${student.user.email}</td>
                <td>
                    <span class="status status-${student.status}">${statusMap[student.status] || student.status}</span>
                </td>
                <td class="actions">
                    <button class="btn-detail" data-id="${student.id}">Detail</button>
                    <button class="btn-terima" data-id="${student.id}" ${student.status === 'SISWA_DITERIMA' ? 'disabled' : ''}>Terima</button>
                    <button class="btn-tolak" data-id="${student.id}" ${student.status === 'SISWA_DITOLAK' ? 'disabled' : ''}>Tolak</button>
                    <button class="btn-hapus" data-userid="${student.user.id}" data-nama="${student.namaLengkap}">Hapus</button>
                </td>
            `;
            studentListBody.appendChild(row);
        });
    };

    // Fungsi untuk mengirim permintaan update status ke server
    const updateStatus = async (studentId, newStatus) => {
        try {
            const response = await fetch(`http://localhost:3001/api/admin/students/${studentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal mengupdate status.');
            }
            alert('Status siswa berhasil diubah!');
            fetchStudents(searchInput.value.trim()); // Muat ulang data dengan query pencarian saat ini
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    // Fungsi untuk mengambil detail dan menampilkan popup
    const showDetailModal = async (studentId) => {
        try {
            const response = await fetch(`http://localhost:3001/api/admin/students/${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Gagal mengambil detail siswa.');
            
            const student = await response.json();
            modalContent.innerHTML = `
                <p><strong>Nama Lengkap:</strong> ${student.namaLengkap}</p>
                <p><strong>NISN:</strong> ${student.nisn || 'Tidak diisi'}</p>
                <p><strong>Tempat, Tgl Lahir:</strong> ${student.tempatLahir}, ${new Date(student.tanggalLahir).toLocaleDateString('id-ID')}</p>
                <p><strong>Alamat:</strong> ${student.alamat}</p>
                <p><strong>Sekolah Asal:</strong> ${student.sekolahAsal}</p>
                <p><strong>Nama Orang Tua:</strong> ${student.namaOrangTua}</p>
                <p><strong>Nomor Telepon:</strong> ${student.nomorTelepon}</p>
                <p><strong>Didaftarkan oleh:</strong> ${student.user.email}</p>
            `;
            detailModal.style.display = 'flex';
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    // Fungsi untuk menghapus pengguna
    const deleteUser = async (userId, studentName) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus akun pendaftar untuk siswa bernama "${studentName}"? Tindakan ini tidak dapat dibatalkan.`)) {
            return;
        }
        try {
            const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Gagal menghapus pengguna.');
            
            alert(data.message);
            fetchStudents(searchInput.value.trim()); // Muat ulang data
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    // Event listener untuk form pencarian
    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        fetchStudents(searchInput.value.trim());
    });

    // Menangani klik pada tombol-tombol di dalam tabel
    studentListBody.addEventListener('click', (event) => {
        const target = event.target;
        const studentId = target.dataset.id;
        
        if (target.classList.contains('btn-detail')) {
            showDetailModal(studentId);
        } else if (target.classList.contains('btn-terima')) {
            updateStatus(studentId, 'SISWA_DITERIMA');
        } else if (target.classList.contains('btn-tolak')) {
            updateStatus(studentId, 'SISWA_DITOLAK');
        } else if (target.classList.contains('btn-hapus')) {
            const userId = target.dataset.userid;
            const studentName = target.dataset.nama;
            deleteUser(userId, studentName);
        }
    });

    // Menutup popup
    closeModalButton.addEventListener('click', () => detailModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == detailModal) {
            detailModal.style.display = 'none';
        }
    });

    // Jalankan fungsi utama saat halaman dimuat
    fetchStudents();
});

