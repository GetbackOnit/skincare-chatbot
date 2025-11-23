const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ MongoDB 연결 실패:', err);
  process.exit(1);
});

// Product 스키마 (server.js와 동일)
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

// CSV 파일 읽기 및 MongoDB에 저장
async function importCSV() {
  const products = [];
  const csvFile = 'products.csv'; // 같은 디렉토리의 products.csv 파일
  
  // 파일 존재 확인
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ 오류: ${csvFile} 파일을 찾을 수 없습니다.`);
    console.error('   프로젝트 최상단에 products.csv 파일을 만들어주세요.');
    process.exit(1);
  }
  
  console.log(`📄 ${csvFile} 파일 읽기 중...`);
  
  // CSV 파일 읽기
  fs.createReadStream(csvFile)
    .pipe(csv())
    .on('data', (row) => {
      try {
        // 데이터 검증 및 변환
        if (!row.name || !row.brand || !row.price) {
          console.warn('⚠️  필수 정보 누락:', row.name);
          return;
        }
        
        const product = {
          id: Date.now() + Math.random(), // 고유 ID 생성
          name: row.name.trim(),
          brand: row.brand.trim(),
          price: parseInt(row.price.toString().replace(/[^0-9]/g, '')),
          benefit: row.benefit ? row.benefit.trim() : '',
          skinType: row.skinType ? row.skinType.trim() : 'dry', // 기본값
          ingredients: row.ingredients ? row.ingredients.split(',').map(i => i.trim()).filter(i => i) : [],
          warnings: row.warnings ? row.warnings.split(',').map(w => w.trim()).filter(w => w) : [],
          image: row.image ? row.image.trim() : '',
          rating: row.rating ? parseFloat(row.rating) : 0
        };
        
        // skinType 검증
        const validSkinTypes = ['oily', 'dry', 'combination', 'sensitive'];
        if (!validSkinTypes.includes(product.skinType)) {
          console.warn(`⚠️  유효하지 않은 피부타입 "${product.skinType}" → 기본값 "dry"로 변경`);
          product.skinType = 'dry';
        }
        
        products.push(product);
      } catch (error) {
        console.error('❌ 행 파싱 오류:', error.message);
      }
    })
    .on('end', async () => {
      console.log(`\n📊 CSV 파일 읽기 완료. 총 ${products.length}개 행 감지\n`);
      
      if (products.length === 0) {
        console.error('❌ 읽을 제품이 없습니다. CSV 파일을 확인해주세요.');
        await mongoose.connection.close();
        process.exit(1);
      }
      
      // MongoDB에 저장
      let savedCount = 0;
      let skippedCount = 0;
      
      for (const productData of products) {
        try {
          // 중복 확인 (이름+브랜드로)
          const exists = await Product.findOne({
            name: productData.name,
            brand: productData.brand
          });
          
          if (!exists) {
            const product = new Product(productData);
            await product.save();
            savedCount++;
            console.log(`✅ 저장 (${savedCount}): ${productData.brand} | ${productData.name} | ₩${productData.price}`);
          } else {
            skippedCount++;
            console.log(`⏭️  이미 존재: ${productData.brand} | ${productData.name}`);
          }
          
          // 서버 부담 줄이기
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error(`❌ 저장 실패: ${productData.name}`, error.message);
        }
      }
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 작업 완료!`);
      console.log(`   ✅ 새로 저장된 제품: ${savedCount}개`);
      console.log(`   ⏭️  기존 제품 (스킵): ${skippedCount}개`);
      console.log(`${'='.repeat(60)}\n`);
      
      await mongoose.connection.close();
      process.exit(0);
    })
    .on('error', (error) => {
      console.error('❌ CSV 파일 읽기 오류:', error);
      process.exit(1);
    });
}

// 실행
importCSV();