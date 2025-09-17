// --- Bagian 1: Import Semua Library yang Dibutuhkan ---
import express from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// --- Bagian 2: Inisialisasi & Konfigurasi Awal ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;
const JWT_SECRET = 'ganti-sesuai-maunya';

// Konfigurasi Multer untuk upload file
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.user.userId}-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Konfigurasi Nodemailer untuk pengiriman email
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'ganti.dengan.email.anda@gmail.com', // GANTI INI
        pass: 'ganti.dengan.sandi.aplikasi.anda'    // GANTI INI
    }
});

// --- Bagian 3: Middleware ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir)); // Membuat folder uploads dapat diakses publik

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: "Akses ditolak. Rute ini hanya untuk admin." });
    }
    next();
};

// --- Bagian 4: Endpoints API ---

// ===================================
//      API AUTENTIKASI PENGGUNA
// ===================================
app.post('/api/auth/register', async (req, res) => {
    const { nama, email, password } = req.body;
    try {
        const hashedPassword = await bcryptjs.hash(password, 12);
        const newUser = await prisma.user.create({ data: { nama, email, password: hashedPassword } });
        res.status(201).json({ message: 'Akun berhasil dibuat!', userId: newUser.id });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ message: 'Email ini sudah terdaftar.' });
        console.error("Error Registrasi:", error);
        res.status(500).json({ message: 'Gagal mendaftarkan pengguna.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Email tidak ditemukan.' });

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Password salah.' });

        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, nama: user.nama }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ message: 'Login berhasil!', token });
    } catch (error) {
        console.error("Error Login:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ===================================
//      API DATA SISWA (UNTUK USER)
// ===================================
app.post('/api/siswa', authenticateToken, async (req, res) => {
    const data = req.body;
    const userId = req.user.userId;
    try {
        const newStudent = await prisma.student.create({ data: { ...data, tanggalLahir: new Date(data.tanggalLahir), userId } });
        res.status(201).json({ message: 'Data siswa berhasil didaftarkan!', student: newStudent });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ message: "Anda sudah pernah mendaftarkan siswa atau NISN sudah ada." });
        console.error("Error Pendaftaran Siswa:", error);
        res.status(500).json({ message: "Terjadi kesalahan saat menyimpan data." });
    }
});

app.get('/api/siswa', authenticateToken, async (req, res) => {
    try {
        const student = await prisma.student.findUnique({ where: { userId: req.user.userId } });
        if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
        res.json(student);
    } catch (error) {
        console.error("Error GET Siswa:", error);
        res.status(500).json({ message: "Terjadi kesalahan di server." });
    }
});

app.patch('/api/siswa', authenticateToken, async (req, res) => {
    const data = req.body;
    try {
        const updatedStudent = await prisma.student.update({
            where: { userId: req.user.userId },
            data: { ...data, tanggalLahir: new Date(data.tanggalLahir) }
        });
        res.status(200).json({ message: 'Data berhasil diperbarui!', student: updatedStudent });
    } catch (error) {
        console.error("Error Update Siswa:", error);
        res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui data.' });
    }
});

app.post('/api/siswa/upload-berkas', authenticateToken, upload.fields([{ name: 'fileIjazah', maxCount: 1 }, { name: 'fileAkta', maxCount: 1 }, { name: 'fileKk', maxCount: 1 }]), async (req, res) => {
    try {
        const filePaths = {};
        if (req.files.fileIjazah) filePaths.fileIjazah = req.files.fileIjazah[0].path;
        if (req.files.fileAkta) filePaths.fileAkta = req.files.fileAkta[0].path;
        if (req.files.fileKk) filePaths.fileKk = req.files.fileKk[0].path;
        
        await prisma.student.update({ where: { userId: req.user.userId }, data: filePaths });
        res.status(200).json({ message: 'Berkas berhasil diunggah!' });
    } catch (error) {
        console.error("Error Upload Berkas:", error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengunggah berkas.' });
    }
});

// ===================================
//      API ADMIN
// ===================================
app.get('/api/admin/students', authenticateToken, authorizeAdmin, async (req, res) => {
    const { search } = req.query;
    const whereClause = search ? { OR: [{ namaLengkap: { contains: search, mode: 'insensitive' } }, { nisn: { contains: search, mode: 'insensitive' } }] } : {};
    try {
        const students = await prisma.student.findMany({ where: whereClause, include: { user: { select: { id: true, email: true } } }, orderBy: { createdAt: 'desc' } });
        res.json(students);
    } catch (error) {
        console.error("Error GET All Students (Admin):", error);
        res.status(500).json({ message: "Terjadi kesalahan di server." });
    }
});

app.get('/api/admin/students/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const student = await prisma.student.findUnique({ where: { id: req.params.id }, include: { user: { select: { email: true } } } });
        if (!student) return res.status(404).json({ message: "Data siswa tidak ditemukan." });
        res.json(student);
    } catch (error) {
        console.error("Error GET Student by ID (Admin):", error);
        res.status(500).json({ message: "Terjadi kesalahan di server." });
    }
});

app.patch('/api/admin/students/:id/status', authenticateToken, authorizeAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['SISWA_DITERIMA', 'SISWA_DITOLAK'].includes(status)) return res.status(400).json({ message: "Status tidak valid." });
    try {
        const updatedStudent = await prisma.student.update({ where: { id: req.params.id }, data: { status } });
        res.json({ message: 'Status siswa berhasil diupdate!', student: updatedStudent });
    } catch (error) {
        console.error("Error Update Status (Admin):", error);
        res.status(500).json({ message: "Gagal mengupdate status." });
    }
});

app.delete('/api/admin/users/:userId', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        await prisma.$transaction([
            prisma.student.deleteMany({ where: { userId: req.params.userId } }),
            prisma.user.delete({ where: { id: req.params.userId } })
        ]);
        res.status(200).json({ message: 'Pengguna dan data siswa terkait berhasil dihapus.' });
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
        console.error("Error Hapus User (Admin):", error);
        res.status(500).json({ message: 'Terjadi kesalahan saat menghapus pengguna.' });
    }
});

// ===================================
//      API RESET PASSWORD
// ===================================
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(200).json({ message: 'Jika email Anda terdaftar, link reset akan dikirim.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

        await prisma.user.update({ where: { email }, data: { passwordResetToken, passwordResetExpires } });

        const resetURL = `http://localhost:3001/reset-password.html?token=${resetToken}`;
        
        await transporter.sendMail({
            from: `"Admin PPDB" <ganti.dengan.email.anda@gmail.com>`,
            to: user.email,
            subject: 'Link Atur Ulang Password PPDB',
            html: `<p>Silakan klik link di bawah untuk mengatur ulang password Anda. Link ini valid selama 10 menit.</p><a href="${resetURL}" style="background-color:#6366f1;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">Atur Ulang Password</a>`
        });

        res.status(200).json({ message: 'Jika email Anda terdaftar, link reset akan dikirim.' });
    } catch (error) {
        console.error("Error Forgot Password:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await prisma.user.findFirst({ where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } } });

        if (!user) return res.status(400).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });

        const hashedPassword = await bcryptjs.hash(password, 12);
        await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null } });

        res.status(200).json({ message: 'Password berhasil diatur ulang. Silakan login.' });
    } catch (error) {
        console.error("Error Reset Password:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// --- Bagian 5: Menjalankan Server ---
app.listen(PORT, () => {
  console.log(`Server backend berjalan di http://localhost:${PORT}`);
});


