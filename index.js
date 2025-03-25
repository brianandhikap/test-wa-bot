const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const SEASON_NAME = "Rezza Store V1";

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
  authStrategy: new LocalAuth(),
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  clientName: `Google Chrome (${SEASON_NAME})`,
});

const workingHours = {
  Monday: [9, 21],
  Tuesday: [9, 21],
  Wednesday: [9, 21],
  Thursday: [9, 21],
  Friday: [9, 21],
  Saturday: [9, 21],
  Sunday: [12, 21],
};

const hargaBarang = {
  Barang1: { "1": "Rp 30.000", "2": "Rp 50.000", "3": "Rp 75.000" },
  Barang2: { "1": "Rp 40.000", "2": "Rp 60.000", "3": "Rp 85.000" },
  Barang3: { "1": "Rp 10.000", "2": "Rp 20.000", "3": "Rp 35.000" },
  Barang4: { "1": "Rp 15.000", "2": "Rp 25.000", "3": "Rp 55.000" }
};

const userState = {};
const lastInteraction = {};
const TIMEOUT_MINUTES = 30 * 60 * 1000;

const resetSession = (chatId) => {
  delete userState[chatId];
  delete lastInteraction[chatId];
};

const checkTimeout = () => {
  const now = Date.now();
  for (const chatId in lastInteraction) {
    if (now - lastInteraction[chatId] > TIMEOUT_MINUTES) {
      resetSession(chatId);
      console.log(`Reset session for ${chatId} due to timeout.`);
    }
  }
};
setInterval(checkTimeout, 60 * 1000);

const showMainMenu = async (chatId) => {
  userState[chatId] = { stage: 'menu', selectedBarang: null };
  await client.sendMessage(chatId, `Terima kasih telah menghubungi *${SEASON_NAME}*!

*Jam operasional Rezza PHD:*
Senin-Sabtu: 09.00-21.00
Minggu: 12.00 - 21.00

Silahkan pilih menu:
Ketik 1 untuk Barang1
Ketik 2 untuk Barang2
Ketik 3 untuk Barang3
Ketik 4 untuk Barang4`);
};

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log(`${SEASON_NAME} is ready!`);
});

client.on("message", async (msg) => {
  const chatId = msg.from;
  const text = msg.body.trim();
  console.log(`Received message: ${text} from ${chatId}`);
  lastInteraction[chatId] = Date.now();

  if (!userState[chatId]) {
    userState[chatId] = {
      stage: 'menu',
      selectedBarang: null
    };
  }

  if (text === "0") {
    await showMainMenu(chatId);
    return;
  }

  if (userState[chatId].stage === 'menu') {
    if (["1", "2", "3", "4"].includes(text)) {
      const barangKey = `Barang${text}`;
      userState[chatId] = {
        stage: 'price_selection',
        selectedBarang: barangKey
      };
      
      const imagePath = path.join(__dirname, "banner", `${barangKey}.jpg`);
      const hargaList = hargaBarang[barangKey];
      console.log(`Checking image path: ${imagePath}`);

      if (fs.existsSync(imagePath) && hargaList) {
        let hargaText = `*Harga ${barangKey}:*\n`;
        for (const [key, value] of Object.entries(hargaList)) {
          hargaText += `${key}. ${value}\n`;
        }
        hargaText += "\nKetik 0 untuk kembali ke menu utama.";

        const media = MessageMedia.fromFilePath(imagePath);
        await client.sendMessage(chatId, media, { caption: hargaText });
        console.log(`Sent image for ${barangKey}`);
      } else {
        await client.sendMessage(chatId, `Maaf, pricelist untuk ${barangKey} tidak ditemukan.`);
        console.log(`Image for ${barangKey} not found.`);
        userState[chatId].stage = 'menu';
      }
      return;
    } else {
      await client.sendMessage(chatId, `Halo kak, terima kasih sudah menghubungi Rezza!
Sesaat lagi Rezza akan membalas pesan kakak.
Untuk lihat price list dan order silahkan langsung ketik angka 0, nanti akan dilayani oleh Chatbot
Terima kasih kak.`);
      return;
    }
  } else if (userState[chatId].stage === 'price_selection') {
    const selectedBarang = userState[chatId].selectedBarang;
    
    if (["1", "2", "3"].includes(text) && hargaBarang[selectedBarang] && hargaBarang[selectedBarang][text]) {
      const price = hargaBarang[selectedBarang][text];
      console.log(`User selected ${selectedBarang} with option ${text} - price ${price}`);
      
      await client.sendMessage(
        chatId,
        `Silahkan melakukan pembayaran sebesar ${price} ke nomor rekening:\n\n12412412412 (BCA)\n12412412412424 (Mandiri)\n112412412412 (OVO)\n\nApabila sudah melakukan transfer akan otomatis kami kirimkan datanya kak.`
      );
      
      userState[chatId] = { stage: 'menu', selectedBarang: null };
      return;
    } else if (!["0", "1", "2", "3"].includes(text)) {
      await client.sendMessage(chatId, `Halo kak, terima kasih sudah menghubungi Rezza!
Sesaat lagi Rezza akan membalas pesan kakak.
Untuk lihat price list dan order silahkan langsung ketik angka 0, nanti akan dilayani oleh Chatbot
Terima kasih kak.`);
      return;
    } else {
      await client.sendMessage(chatId, "Maaf, pilihan tidak valid. Silahkan pilih nomor harga yang tersedia atau ketik 0 untuk kembali ke menu utama.");
      return;
    }
  }
});

client.initialize();
