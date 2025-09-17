document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerButton = document.getElementById('register-button');
    const messageDiv = document.getElementById('message');

    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Mencegah halaman refresh

        // Ambil semua nilai dari formulir
        const nama = document.getElementById('nama').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const passwordKonfirmasi = document.getElementById('password_konfirmasi').value;
        
        // Bersihkan pesan error/sukses sebelumnya
        messageDiv.textContent = '';
        messageDiv.className = '';

        // Validasi frontend: pastikan password cocok
        if (password !== passwordKonfirmasi) {
            messageDiv.textContent = 'Password dan konfirmasi password tidak cocok!';
            messageDiv.className = 'message message-error';
            return;
        }

        // Beri feedback visual ke pengguna
        registerButton.disabled = true;
        registerButton.textContent = 'Mendaftarkan...';

        try {
            // Kirim data ke server
            const response = await fetch('http://localhost:3001/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Jika pendaftaran berhasil
                messageDiv.textContent = data.message || 'Registrasi berhasil! Mengarahkan ke halaman login...';
                messageDiv.className = 'message message-success';
                // Tunggu 2 detik lalu arahkan ke halaman login
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                // Jika server memberikan respons error (misal: email sudah terdaftar)
                messageDiv.textContent = data.message || 'Registrasi gagal.';
                messageDiv.className = 'message message-error';
                registerButton.disabled = false;
                registerButton.textContent = 'Daftar';
            }
        } catch (error) {
            // Jika gagal terhubung ke server
            messageDiv.textContent = 'Gagal terhubung ke server. Periksa koneksi Anda.';
            messageDiv.className = 'message message-error';
            registerButton.disabled = false;
            registerButton.textContent = 'Daftar';
        }
    });
});

