const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 이미지 폴더 정적 제공
app.use('/images', express.static('product_images'));

// CORS 설정 (모든 도메인에서 요청 허용)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    oily: '하루 2번 클렌징과 가벼운 토너 사용을 권장합니다. BHA, 티트리, 녹차 성분의 제품을 추천합니다!',
    dry: '보습 에센스와 크림 마스크를 정기적으로 사용하세요. 그리고 히알루론산과 세라마이드 성분의 제품을 추천합니다!',
    combination: 'T존은 가볍게, 건조한 부위는 진하게 사용하세요. BHA, 녹차 성분의 제품을 추천합니다!',
    sensitive: '자극 최소화 제품부터 시작하여 천천히 라인 추가하세요. 센텔라, 마데카소사이드, 어성초, 티트리 성분의 제품을 추천합니다!'
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
    const { skinType, preferences } = req.body;
    
    console.log('🔍 요청받은 skinType:', skinType);
    console.log('🔍 요청받은 preferences:', preferences);
    
    // 기본 조건: 피부타입
    let query = { skinType };
    
    // 선호도에 따른 필터 추가
    if (preferences && preferences.length > 0) {
      const filters = [];
      
      preferences.forEach(pref => {
        if (pref === 'organic') {
          // 저가격: 30,000원 이하
          console.log('💰 저가격 필터 적용');
          filters.push({ price: { $lte: 30000 } });
        } else if (pref === 'antiaging') {
          // 안티에이징: benefit이나 name에 관련 키워드 포함
          console.log('✨ 안티에이징 필터 적용');
          filters.push({
            $or: [
              { benefit: { $regex: '탄력|주름|안티에이징|에센스', $options: 'i' } },
              { name: { $regex: '세럼|에센스|앰플', $options: 'i' } }
            ]
          });
        } else if (pref === 'hydration') {
          // 수분보충: benefit이나 name에 보습 관련 키워드
          console.log('💧 수분보충 필터 적용');
          filters.push({
            $or: [
              { benefit: { $regex: '보습|수분|에센스', $options: 'i' } },
              { name: { $regex: '에센스|토너|에센셜', $options: 'i' } }
            ]
          });
        }
      });
      
      // 모든 필터 조건을 OR로 결합 (하나라도 일치하면 표시)
      if (filters.length > 0) {
        query = { $and: [{ skinType }, { $or: filters }] };
      }
    }
    
    console.log('🔎 최종 쿼리:', JSON.stringify(query, null, 2));
    
    const products = await Product.find(query).limit(10);
    
    console.log('🔍 DB에서 찾은 제품 수:', products.length);
    
    const productsWithImages = products.map(p => {
      let imageUrl = null;
      
      if (p.image) {
        if (p.image.startsWith('http')) {
          imageUrl = p.image;
        } else {
          imageUrl = `https://skincare-chatbot-production-9ad6.up.railway.app/images/${p.image}`;
        }
      }
      
      return {
        id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        image: imageUrl || null,
        rating: p.rating
      };
    });
    
    console.log('📦 최종 반환 제품:', productsWithImages.length);
    
    const advice = generateAdvice(skinType);
    
    res.json({
      message: `피부를 위한 추천 제품입니다!`,
      advice: advice,
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
  console.log(`Server running on port ${PORT}`);
});