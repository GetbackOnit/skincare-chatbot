const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3000;

// ← 이 부분 추가
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 정적 파일 제공 (CSS, JS 등) - 다른 라우트 뒤에 배치
app.use(express.static(path.join(__dirname)));

// 화장품 데이터베이스
const products = {
  oily: [
    { id: 1, name: '클린징 포암', brand: 'A브랜드', price: 8000, benefit: '피지 제거' },
    { id: 2, name: '매트 토너', brand: 'B브랜드', price: 12000, benefit: '유분 조절' }
  ],
  dry: [
    { id: 3, name: '보습 에센스', brand: 'C브랜드', price: 15000, benefit: '수분 공급' },
    { id: 4, name: '크림 마스크', brand: 'D브랜드', price: 20000, benefit: '진정' }
  ],
  combination: [
    { id: 5, name: '밸런스 토너', brand: 'E브랜드', price: 11000, benefit: '유수분 밸런스' }
  ],
  sensitive: [
    { id: 6, name: '순한 클렌저', brand: 'F브랜드', price: 10000, benefit: '자극 최소화' }
  ]
};

// 피부타입별 조언 생성
function generateAdvice(skinType) {
  const advices = {
    oily: '하루 2번 클렌징과 가벼운 토너 사용을 권장합니다.',
    dry: '보습 에센스와 크림 마스크를 정기적으로 사용하세요.',
    combination: 'T존은 가볍게, 건조한 부위는 진하게 사용하세요.',
    sensitive: '자극 최소화 제품부터 시작하여 천천히 라인 추가하세요.'
  };
  return advices[skinType];
}

function getSkinTypeLabel(type) {
  const labels = {
    oily: '지성',
    dry: '건성',
    combination: '복합성',
    sensitive: '민감성'
  };
  return labels[type];
}

app.post('/chat', (req, res) => {
  const { skinType, concern } = req.body;
  
  if (!skinType || !['oily', 'dry', 'combination', 'sensitive'].includes(skinType)) {
    return res.status(400).json({ error: '유효한 피부타입을 선택해주세요' });
  }
  
  const recommended = products[skinType];
  
  res.json({
    message: `${getSkinTypeLabel(skinType)} 피부를 위한 추천 제품입니다.`,
    products: recommended,
    advice: generateAdvice(skinType)
  });
});

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
