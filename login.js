// Fungsi untuk "membongkar" token JWT dan membaca isinya
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Gagal mem-parsing token:", e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const messageDiv = document.getElementById('message');

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Mencegah halaman refresh

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Beri feedback visual ke pengguna
        loginButton.disabled = true;
        loginButton.textContent = 'Memproses...';
        messageDiv.textContent = '';
        messageDiv.className = '';

        try {
            const response = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Jika login berhasil
                const token = data.token;
                localStorage.setItem('authToken', token);
                
                messageDiv.textContent = data.message || 'Login berhasil! Mengarahkan...';
                messageDiv.className = 'message message-success';
                
                const userPayload = parseJwt(token); // Baca peran dari token

                // Arahkan ke halaman yang sesuai setelah 1.5 detik
                setTimeout(() => {
                    if (userPayload && userPayload.role === 'ADMIN') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);

            } else {
                // Jika server memberikan respons error (misal: password salah)
                messageDiv.textContent = data.message || 'Email atau password salah.';
                messageDiv.className = 'message message-error';
                loginButton.disabled = false;
                loginButton.textContent = 'Masuk';
            }

        } catch (error) {
            // Jika gagal terhubung ke server
            messageDiv.textContent = 'Gagal terhubung ke server. Periksa koneksi Anda.';
            messageDiv.className = 'message message-error';
            loginButton.disabled = false;
            loginButton.textContent = 'Masuk';
        }
    });
});

