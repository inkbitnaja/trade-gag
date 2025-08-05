// 1. นำเข้า Express และสร้างแอปพลิเคชัน
const express = require('express');
const app = express();
app.use(express.json()); // เปิดใช้งานการรับข้อมูลแบบ JSON

// 2. ส่วนเก็บข้อมูล (In-Memory Database)
//    - เราจะใช้ Object ธรรมดาเพื่อเก็บข้อมูลผู้รับที่กำลังออนไลน์
//    - key คือ 'jobId' เพื่อให้ง่ายต่อการค้นหาและลบ
let activeReceivers = {};

const TIMEOUT_SECONDS = 90; // กำหนดเวลา Timeout ที่ 90 วินาที

// 3. สร้าง API Endpoints ทั้งหมดที่สคริปต์ต้องการ

// === Endpoint สำหรับ "ลงทะเบียน" ผู้รับใหม่ ===
app.post('/api/register-job', (req, res) => {
    const { receiver, jobId, serverId } = req.body;

    // ตรวจสอบว่าข้อมูลที่ส่งมาครบถ้วนหรือไม่
    if (!receiver || !jobId || !serverId) {
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน (Missing data)" });
    }

    // เพิ่มผู้รับคนใหม่เข้าระบบ
    activeReceivers[jobId] = {
        username: receiver,
        serverId: serverId,
        jobId: jobId,
        lastSeen: Date.now() // บันทึกเวลาที่ลงทะเบียนเป็น timestamp
    };

    console.log(`[+] ผู้รับลงทะเบียน: ${receiver} (Job ID: ${jobId})`);
    res.status(201).json({ success: true, message: `ลงทะเบียน ${receiver} สำเร็จ` });
});

// === Endpoint สำหรับ "อัปเดตสถานะ" (บอกว่ายังออนไลน์) ===
app.post('/api/update-receiver', (req, res) => {
    const { receiver, serverId } = req.body; // สคริปต์ส่งมาแค่ 2 ค่านี้

    // ค้นหา jobId ที่ตรงกับ receiver
    const job = Object.values(activeReceivers).find(r => r.username === receiver);

    if (job) {
        // ถ้าเจอ, อัปเดตเวลา lastSeen
        activeReceivers[job.jobId].lastSeen = Date.now();
        console.log(`[*] อัปเดตสถานะ: ${receiver}`);
        res.json({ success: true, message: `อัปเดต ${receiver} สำเร็จ` });
    } else {
        res.status(404).json({ success: false, message: `ไม่พบผู้รับชื่อ ${receiver}` });
    }
});

// === Endpoint สำหรับ "ค้นหา" ผู้รับที่ออนไลน์อยู่ ===
app.get('/api/check-receivers', (req, res) => {
    // ดึงรายชื่อผู้รับที่ต้องการค้นหาจาก query string
    const requestedUsernames = req.query.usernames ? req.query.usernames.split(',') : [];
    
    const available = [];
    for (const jobId in activeReceivers) {
        const receiver = activeReceivers[jobId];
        const isRequested = requestedUsernames.includes(receiver.username);

        // คืนค่ากลับไปเฉพาะผู้รับที่:
        // 1. อยู่ในรายชื่อที่ผู้ส่งต้องการค้นหา
        // 2. ยังไม่ timeout (lastSeen ยังใหม่)
        if (isRequested) {
            available.push({
                username: receiver.username,
                serverId: receiver.serverId,
            });
        }
    }

    console.log(`[?] ค้นหาผู้รับ: ${requestedUsernames.join(', ')} | พบ: ${available.length} คน`);
    res.json({ success: true, availableReceivers: available });
});

// === Endpoint สำหรับ "ลบ" การลงทะเบียน (เมื่อผู้รับออกจากเกม) ===
app.delete('/api/job/:jobId', (req, res) => {
    const { jobId } = req.params; // ดึง jobId จาก URL path

    if (activeReceivers[jobId]) {
        const username = activeReceivers[jobId].username;
        delete activeReceivers[jobId]; // ลบข้อมูลออกจาก Object
        console.log(`[-] ยกเลิกการลงทะเบียน: ${username} (Job ID: ${jobId})`);
        res.json({ success: true, message: "ลบการลงทะเบียนสำเร็จ" });
    } else {
        res.status(404).json({ success: false, message: "ไม่พบ Job ID" });
    }
});

// === Endpoint (เสริม) สำหรับดูสถานะของเซิร์ฟเวอร์ ===
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            activeJobs: Object.keys(activeReceivers).length,
            activeReceivers: Object.keys(activeReceivers).length, // ในเคสนี้เหมือนกัน
            serverTime: new Date().toISOString()
        }
    });
});

// 4. ฟังก์ชันสำหรับเคลียร์ผู้รับที่ Timeout (สำคัญมาก)
setInterval(() => {
    const now = Date.now();
    for (const jobId in activeReceivers) {
        // ถ้าเวลา lastSeen เก่ากว่า TIMEOUT ที่ตั้งไว้
        if (now - activeReceivers[jobId].lastSeen > TIMEOUT_SECONDS * 1000) {
            console.log(`[!] Timeout: ${activeReceivers[jobId].username} (Job ID: ${jobId})`);
            delete activeReceivers[jobId]; // ลบออกจากระบบ
        }
    }
}, 15 * 1000); // ทำงานทุก 15 วินาที

// 5. สั่งให้เซิร์ฟเวอร์เริ่มทำงาน
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Auto-trade backend server เริ่มทำงานที่ port ${PORT}`);
});