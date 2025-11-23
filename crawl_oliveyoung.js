const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => { console.error('❌ MongoDB 연결 실패:', err); process.exit(1); });

const productSchema = new mongoose.Schema({
  id: Number,
  name: String,
  brand: String,
  price: Number,
  benefit: String,
  skinType: String,
  ingredients: [String],
  warnings: [String],
  image: String,
  rating: Number,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// 이미지 저장 폴더 생성
const imageDir = path.join(__dirname, 'product_images');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
  console.log('📁 product_images 폴더 생성됨');
}

// URL에서 이미지를 로컬 파일로 저장
async function downloadImageAsFile(imageUrl, fileName) {
  return new Promise((resolve) => {
    if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('placeholder')) {
      resolve(null);
      return;
    }

    try {
      const protocol = imageUrl.startsWith('https') ? https : http;
      const fileExt = imageUrl.split('?')[0].split('.').pop() || 'jpg';
      const filePath = path.join(imageDir, `${fileName}.${fileExt}`);

      if (fs.existsSync(filePath)) {
        console.log(`   ⏭️  이미 저장됨: ${fileName}`);
        resolve(filePath);
        return;
      }

      const file = fs.createWriteStream(filePath);

      protocol.get(imageUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        console.log(`🔍 이미지 URL: ${imageUrl}`);
        console.log(`📊 상태코드: ${response.statusCode}`);
        
        // 리다이렉트 처리
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.destroy();
          return downloadImageAsFile(response.headers.location, fileName).then(resolve);
        }

        if (response.statusCode !== 200) {
          file.destroy();
          fs.unlink(filePath, () => {});
          console.log(`   ❌ HTTP ${response.statusCode}`);
          resolve(null);
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`   ✅ 이미지 저장: ${path.basename(filePath)}`);
          resolve(filePath);
        });

        file.on('error', (err) => {
          fs.unlink(filePath, () => {});
          console.log(`   ❌ 저장 실패: ${err.message}`);
          resolve(null);
        });
      }).on('error', (err) => {
        console.log(`   ❌ 다운로드 실패: ${err.message}`);
        resolve(null);
      }).on('timeout', function() {
        this.destroy();
        resolve(null);
      });

    } catch (err) {
      console.log(`   ❌ 예외: ${err.message}`);
      resolve(null);
    }
  });
}

function classifySkinType(productName) {
  const name = productName.toLowerCase();
  
  if (name.includes('지성') || name.includes('오일') || name.includes('모공')) return 'oily';
  if (name.includes('건성') || name.includes('보습') || name.includes('수분')) return 'dry';
  if (name.includes('복합') || name.includes('혼합')) return 'combination';
  if (name.includes('민감') || name.includes('약산성') || name.includes('진정')) return 'sensitive';
  
  return 'combination';
}

async function crawlOliveyoung() {
  console.log('🔄 크롤링 시작...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  try {
    console.log('📱 올리브영 페이지 로드 중...');
    // 기존 제품 삭제 (새로 크롤링할 때마다 갱신)
    await Product.deleteMany({});
    console.log('🗑️  기존 제품 삭제됨\n');
    
    await page.goto('https://www.oliveyoung.co.kr/store/main/getBestList.do', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('📊 데이터 추출 중...\n');
    
    const products = await page.evaluate(() => {
      const items = [];
      const productElements = document.querySelectorAll('.itemCard, .prd_info, [class*="product"]');
      
      productElements.forEach((el) => {
        try {
          const name = el.querySelector('.name, .prd_name, .itemCard_name')?.textContent?.trim() || '';
          const brand = el.querySelector('.brand, .prd_brand, .itemCard_brand')?.textContent?.trim() || 'Unknown';
          
          // 가격 추출 - 더 정확한 방법
          let price = 0;
          
          // 1. 직접 가격 선택자 시도
          const priceElement = el.querySelector('[class*="price"], .price, .prd_price, .salePrice');
          if (priceElement) {
            const priceText = priceElement.textContent;
            const match = priceText.match(/[\d,]+/);
            if (match) {
              price = parseInt(match[0].replace(/,/g, ''));
            }
          }
          
          // 2. 실패하면 모든 텍스트에서 큰 숫자 찾기
          if (price === 0) {
            const allText = el.textContent;
            const prices = allText.match(/\d{3,6}(?:,\d{3})*/g);
            if (prices && prices.length > 0) {
              // 가장 큰 숫자가 가격일 확률이 높음
              price = Math.max(...prices.map(p => parseInt(p.replace(/,/g, ''))));
            }
          }
          
          console.log(`💰 ${name.substring(0, 30)}: ₩${price}`);
          
          const imgElement = el.querySelector('img');
          let image = imgElement?.src || imgElement?.getAttribute('data-src') || imgElement?.getAttribute('data-lazy-src') || '';
          
          if (image && !image.startsWith('http')) {
            image = 'https://www.oliveyoung.co.kr' + (image.startsWith('/') ? '' : '/') + image;
          }
          
          if (name && price > 0 && image && !image.includes('placeholder')) {
            items.push({ name, brand, price, image });
          }
        } catch (err) {
          console.error('파싱 에러:', err.message);
        }
      });
      
      return items;
    });
    
    console.log(`✅ 총 ${products.length}개 제품 추출\n`);
    
    let savedCount = 0;
    for (const pd of products) {
      try {
          let imagePath = null;
          if (pd.image) {
            console.log(`📥 ${pd.name} 이미지 다운로드`);
            const fileName = `${pd.brand}_${pd.name}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            imagePath = await downloadImageAsFile(pd.image, fileName);
            await new Promise(r => setTimeout(r, 300));
          }
          
          const newProduct = new Product({
            id: Date.now() + Math.random(),
            name: pd.name,
            brand: pd.brand,
            price: pd.price,
            image: imagePath ? path.basename(imagePath) : null,
            skinType: classifySkinType(pd.name),
            benefit: '보습',
            ingredients: [],
            warnings: [],
            rating: 4.5
          });
          
          await newProduct.save();
          savedCount++;
          console.log(`✅ 저장: ${pd.brand} - ${pd.name}\n`);
          console.log(`📝 저장 경로: ${imagePath}`);
        
      } catch (error) {
        console.error(`❌ 저장 실패: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 총 ${savedCount}개 제품 저장 완료!\n`);
    
  } catch (error) {
    console.error('❌ 크롤링 에러:', error.message);
  } finally {
    await browser.close();
    await mongoose.connection.close();
  }
}

crawlOliveyoung()
  .then(() => { console.log('✅ 크롤링 종료'); process.exit(0); })
  .catch(err => { console.error('❌ 실패:', err); process.exit(1); });
