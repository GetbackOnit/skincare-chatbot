const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Gemini API 초기화 (없으면 null)
let geminiModel = null;

const app = express();
const PORT = process.env.PORT || 3000;

// 이미지 폴더 정적 제공
app.use('/images', express.static(path.join(__dirname, 'product_images')));

// CORS 설정
app.use(cors());
app.use(bodyParser.json());

// ============ MongoDB 연결 ============
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ MongoDB 연결 실패:', err);
});

// ============ MongoDB 스키마 ============
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

const userSchema = new mongoose.Schema({
  userId: String,
  skinType: String,
  budget: Number,
  allergies: [String],
  preferences: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ============ 헬퍼 함수 ============
function generateAdvice(skinType) {
  const advices = {
    oily: '하루 2번 클렌징과 가벼운 토너 사용을 권장합니다.',
    dry: '보습 에센스와 크림 마스크를 정기적으로 사용하세요.',
    combination: 'T존은 가볍게, 건조한 부위는 진하게 사용하세요.',
    sensitive: '자극 최소화 제품부터 시작하여 천천히 라인 추가하세요.'
  };
  return advices[skinType] || '피부타입에 맞는 제품을 선택하세요.';
}

function getSkinTypeLabel(type) {
  const labels = {
    oily: '지성',
    dry: '건성',
    combination: '복합성',
    sensitive: '민감성'
  };
  return labels[type] || '피부타입';
}

// ============ API 라우트 ============
app.get('/', (req, res) => {
  res.json({ 
    message: '화장품 추천 챗봇 API 서버',
    gemini_status: geminiModel ? 'Active ✅' : 'Inactive ⚠️'
  });
});

// ============ 메인 추천 API ============
app.post('/chat', async (req, res) => {
  try {
    const { skinType } = req.body;
    
    console.log('🔍 요청받은 skinType:', skinType);
    
    const products = await Product.find({ skinType }).limit(5);
    
    console.log('🔍 DB에서 찾은 제품 수:', products.length);
    console.log('🔍 첫번째 제품의 image:', products[0]?.image);
    
    const productsWithImages = products.map(p => {
      let imageUrl = null;
      
      if (p.image) {
        // 이미 전체 URL이면 그대로 사용
        if (p.image.startsWith('http')) {
          imageUrl = p.image;
        } else {
          // 파일명이면 서버 URL과 결합
          imageUrl = `http://192.168.0.9:3000/images/${p.image}`;
        }
      }
      
      console.log('📝 변환 전:', p.image);
      console.log('📝 변환 후:', imageUrl);
      
      return {
        id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        image: imageUrl || null,  // null이 아니면 URL
        rating: p.rating
      };
    });
    
    console.log('📦 최종 반환 제품:', productsWithImages);
    
    res.json({
      message: `피부를 위한 추천 제품입니다!`,
      advice: '올리브영에서 엄선한 최고의 제품들입니다.',
      products: productsWithImages
    });
  } catch (error) {
    console.error('❌ 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ AI 챗봇 대화 API ============
app.post('/chat/message', async (req, res) => {
  try {
    const { message, skinType, products } = req.body;

    console.log('📨 메시지:', message);

    // Gemini API가 없으면 규칙 기반으로
    if (!geminiModel) {
      const responses = {
        '가격': '저가격 제품을 찾으신다면, 예산에 맞는 옵션들이 있습니다.',
        '사용법': `${getSkinTypeLabel(skinType)} 피부에는 하루 2번, 아침 저녁으로 사용하세요.`,
        '효과': '대부분 2-4주 내에 피부 개선을 경험합니다.',
        '추천': products && products.length > 0 ? `${products[0].name}을 추천합니다.` : '제품 추천입니다.',
        '보습': '보습 제품을 함께 사용하세요.',
        '여드름': '여드름 관리 제품을 추천합니다.',
      };

      let botMessage = '좋은 질문입니다!';
      for (const [keyword, answer] of Object.entries(responses)) {
        if (message.includes(keyword)) {
          botMessage = answer;
          break;
        }
      }

      return res.json({ message: botMessage });
    }

    // Gemini API 사용
    const skinTypeLabels = {
      'dry': '건성',
      'oily': '지성',
      'sensitive': '민감성',
      'combination': '복합성'
    };

    const productInfo = products && products.length > 0 
      ? `추천 제품: ${products[0].name}, 가격: ₩${products[0].price?.toLocaleString() || '미정'}`
      : '제품 정보 없음';

    const prompt = `당신은 피부 관리 전문가입니다.
피부타입: ${skinTypeLabels[skinType]}
${productInfo}

사용자: "${message}"

한국어로 친절하게 2-3문장 답변하세요.`;

    console.log('🤖 Gemini 요청 중...');
    const result = await geminiModel.generateContent(prompt);
    const botMessage = result.response.text();

    console.log('✅ 응답:', botMessage);
    res.json({ message: botMessage });

  } catch (error) {
    console.error('❌ 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ 서버 시작 ============
app.listen(PORT, () => {
  console.log(`✅ 서버가 포트 ${PORT}에서 실행 중입니다.`);
});