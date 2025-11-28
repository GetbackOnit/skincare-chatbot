import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform, FlatList, Image, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';
const { width, height } = Dimensions.get('window');

// 웹/앱 반응형 너비
const containerWidth = isWeb ? Math.min(width, 480) : width;
const pageStyle = isWeb ? { maxWidth: 480, marginHorizontal: 'auto' } : {};

export default function App() {
  const [selectedSkinType, setSelectedSkinType] = useState<string | null>(null);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'skinType' | 'preferences' | 'info' | null>(null);
  const slideAnim = React.useRef(new Animated.Value(-width * 0.85)).current;

  React.useEffect(() => {
    if (menuVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width * 0.85,
        duration: 300,
        useNativeDriver: false,
      }).start();
      // 메뉴가 닫힐 때 activeTab 초기화
      setActiveTab(null);
    }
  }, [menuVisible]);

  const skinTypes = [
    { label: '건성', value: 'dry', color: '#a8c9a8' },
    { label: '지성', value: 'oily', color: '#8fba8f' },
    { label: '민감성', value: 'sensitive', color: '#768276' },
    { label: '복합성', value: 'combination', color: '#5a6f5b' }
  ];

  const preferences = [
    { label: '저가격', value: 'organic', color: '#a8c9a8' },
    { label: '수분보충', value: 'antiaging', color: '#768276' },
    { label: '안티에이징', value: 'hydration', color: '#5a6f5b' }
  ];

  const togglePreference = (value: string) => {
    setSelectedPreferences(prev =>
      prev.includes(value)
        ? prev.filter(p => p !== value)
        : [...prev, value]
    );
  };

  const API_URL = '192.168.0.9:3000';

  const handleGetRecommendation = async () => {
    if (!selectedSkinType) {
      Alert.alert('알림', '피부타입을 선택해주세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          skinType: selectedSkinType,
          preferences: selectedPreferences
        })
      });
      
      const data = await response.json();
      
      console.log('📸 제품 이미지 데이터:', data.products[0]?.image);
      
      setRecommendations(data);
      
      setMessages([
        {
          id: 1,
          text: `${data.message}\n\n💡 ${data.advice}`,
          sender: 'bot'
        }
      ]);
      
    } catch (error) {
      Alert.alert('오류', '서버 연결 실패');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: chatInput,
      sender: 'user'
    };
    
    setMessages([...messages, userMessage]);

    try {
      const response = await fetch(`http://${API_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          skinType: selectedSkinType,
          products: recommendations.products
        })
      });

      const data = await response.json();
      
      setTimeout(() => {
        const botResponse = {
          id: messages.length + 2,
          text: data.message,
          sender: 'bot'
        };
        setMessages(prev => [...prev, botResponse]);
      }, 500);

    } catch (error) {
      console.error('메시지 전송 오류:', error);
      const botResponse = {
        id: messages.length + 2,
        text: '죄송합니다. 다시 시도해주세요.',
        sender: 'bot'
      };
      setMessages(prev => [...prev, botResponse]);
    }
    
    setChatInput('');
  };

  // 추천 화면
  if (recommendations) {
    return (
     <KeyboardAvoidingView 
       behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
       style={{ flex: 1 }}
       keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
     >
      <ScrollView 
        style={{ flex: 1, backgroundColor: '#f5f3f0' }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
      >
        {/* 헤더 */}
        <View style={styles.chatHeader}>
          <View>
            <Text style={styles.chatHeaderTitle}>추천 제품</Text>
            <Text style={styles.chatHeaderSubtitle}>AI 스킨케어 가이드</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setRecommendations(null);
              setMessages([]);
              setChatInput('');
              setSelectedSkinType(null);
            }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 채팅 메시지 */}
        <View style={styles.messagesContainer}>
          {messages.map((item) => (
            <View
              key={item.id}
              style={[

                styles.messageBubble,
                item.sender === 'user' ? styles.userMessage : styles.botMessage
              ]}
            >
              <Text
                style={[

                  styles.messageText,
                  item.sender === 'user' && styles.userMessageText
                ]}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        {/* 제품 추천 카드 */}
        {messages.length === 1 && recommendations.products && recommendations.products.length > 0 && (
          <View style={styles.productsSection}>
            <Text style={styles.productsTitle}>추천 상품</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.productsScroll}
              contentContainerStyle={{ paddingRight: 16 }}
              scrollEnabled={true}
            >
              {recommendations.products.map((product: any, index: number) => (
                <View key={index} style={styles.productCard}>
                  <View style={styles.productImageContainer}>
                    {product.image && product.image.startsWith('http') ? (
                      <Image
                        source={{
                          uri: product.image
                        }}
                        style={styles.productImage}
                        onError={(e) => console.log('이미지 로드 실패:', product.image, e.nativeEvent.error)}
                      />
                    ) : (
                      <View style={styles.placeholderImage}>
                        <Text style={styles.placeholderText}>🧴</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    <Text style={styles.productBrand}>{product.brand}</Text>
                    <View style={styles.productFooter}>
                      <Text style={styles.productPrice}>₩{product.price?.toLocaleString()}</Text>
                      <Text style={styles.rating}>★ {product.rating}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 키보드 위 여유 공간 */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* 하단 입력 영역 - 고정 */}
      <View style={styles.bottomContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="더 궁금하신 점을 물어보세요"
            placeholderTextColor="#aaa"
            value={chatInput}
            onChangeText={setChatInput}
            multiline
            maxLength={200}
            editable={true}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.sendButton, !chatInput.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!chatInput.trim()}
          >
            <Text style={styles.sendButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
     </KeyboardAvoidingView>
    );
  }

  // 선택 화면
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 배경 오버레이 */}
      {menuVisible && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* 1. Header Section with Background */}
        <View style={styles.headerBackground}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setMenuVisible(true)}>
              <Ionicons name="menu-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="leaf" size={20} color="#fff" style={{ marginRight: 5 }} />
              <Text style={styles.logoText}>Olive Young{'\n'}Beauty Guide</Text>
            </View>
            <View style={{ width: 28 }} />
          </View>

          {/* 2. Main Title */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Find Your Perfect Match</Text>
          </View>
        </View>

        {/* 3. Bottom Sheet / White Card */}
        <View style={styles.mainCard}>
          
          {/* 피부타입 섹션 */}
          <View style={[styles.cardSection, { backgroundColor: '#fff' }]}>
            <Text style={styles.cardSectionTitle}>Skin Type</Text>
            <View style={[styles.skinTypeGrid, { backgroundColor: '#fff' }]}>
              {skinTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  activeOpacity={0.7}
                  style={[
                    styles.skinTypeButton,
                    { backgroundColor: type.color },
                    selectedSkinType === type.value && styles.skinTypeButtonSelected
                  ]}
                  onPress={() => setSelectedSkinType(type.value)}
                >
                  <Text style={[
                    styles.skinTypeButtonText,
                    selectedSkinType === type.value && styles.skinTypeButtonTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* 선호도 섹션 */}
          <View style={[styles.cardSection, { backgroundColor: '#fff' }]}>
            <Text style={styles.cardSectionTitle}>Preferences</Text>
            <View style={[styles.preferencesGrid, { backgroundColor: '#fff' }]}>
              {preferences.map((pref) => (
                <TouchableOpacity
                  key={pref.value}
                  activeOpacity={0.7}
                  style={[
                    styles.preferenceButton,
                    { backgroundColor: pref.color },
                    selectedPreferences.includes(pref.value) && styles.preferenceButtonSelected
                  ]}
                  onPress={() => togglePreference(pref.value)}
                >
                  <Text style={[
                    styles.preferenceButtonText,
                    selectedPreferences.includes(pref.value) && styles.preferenceButtonTextSelected
                  ]}>
                    {pref.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 버튼 섹션 */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
             style={[styles.getRecommendationButton, loading && styles.getRecommendationButtonDisabled]}
              onPress={handleGetRecommendation}
              activeOpacity={0.8}
             disabled={loading}
            >
             <View style={styles.glossShine} />
              <Text style={styles.getRecommendationButtonText}>
               {loading ? '분석 중...' : 'Discover Products'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 슬라이드 메뉴 */}
      <Animated.View
        style={[
          styles.slideMenu,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* 메뉴 헤더 */}
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Menu</Text>
          <TouchableOpacity onPress={() => setMenuVisible(false)}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* 탭 버튼들 */}
        <View style={styles.menuTabButtons}>
          <TouchableOpacity
            style={[styles.menuTabButton, activeTab === 'skinType' && styles.menuTabButtonActive]}
            onPress={() => setActiveTab('skinType')}
          >
            <Text style={[styles.menuTabButtonText, activeTab === 'skinType' && styles.menuTabButtonTextActive]}>
              Skin Type
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuTabButton, activeTab === 'preferences' && styles.menuTabButtonActive]}
            onPress={() => setActiveTab('preferences')}
          >
            <Text style={[styles.menuTabButtonText, activeTab === 'preferences' && styles.menuTabButtonTextActive]}>
              Preferences
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuTabButton, activeTab === 'info' && styles.menuTabButtonActive]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.menuTabButtonText, activeTab === 'info' && styles.menuTabButtonTextActive]}>
              About
            </Text>
          </TouchableOpacity>
        </View>

        {/* 탭 콘텐츠 */}
        <ScrollView style={styles.menuTabContent}>
          {activeTab === 'skinType' && (
            <View style={styles.menuTabPanel}>
              <Text style={styles.menuPanelTitle}>피부 타입 선택</Text>
              <Text style={styles.menuPanelDescription}>
                당신의 피부 타입을 선택하면, AI가 맞춤형 제품을 추천해드립니다.
              </Text>
              <View style={styles.menuPanelGrid}>
                {skinTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.menuPanelButton,
                      { backgroundColor: type.color },
                      selectedSkinType === type.value && styles.menuPanelButtonSelected
                    ]}
                    onPress={() => {
                     setSelectedSkinType(type.value);
                     setTimeout(() => setMenuVisible(false), 300);
                   }}
                  >
                    <Text style={styles.menuPanelButtonText}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'preferences' && (
            <View style={styles.menuTabPanel}>
              <Text style={styles.menuPanelTitle}>선호도 선택</Text>
              <Text style={styles.menuPanelDescription}>
                원하는 제품 특성을 선택해주세요. (선택사항)
              </Text>
              <View style={styles.menuPanelGrid}>
                {preferences.map((pref) => (
                  <TouchableOpacity
                    key={pref.value}
                    style={[
                      styles.menuPanelButton,
                      { backgroundColor: pref.color },
                      selectedPreferences.includes(pref.value) && styles.menuPanelButtonSelected
                    ]}
                    onPress={() => togglePreference(pref.value)}
                  >
                    <Text style={styles.menuPanelButtonText}>{pref.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'info' && (
            <View style={styles.menuTabPanel}>
              <Text style={styles.menuPanelTitle}>Olive Young Beauty Guide</Text>
              <Text style={styles.menuPanelDescription}>
                AI 기술을 활용하여 당신의 피부에 가장 적합한 제품을 추천해드립니다.
              </Text>
              <View style={styles.menuInfoBox}>
                <Text style={styles.menuInfoTitle}>✨ 특징</Text>
                <Text style={styles.menuInfoText}>• 개인 맞춤형 제품 추천</Text>
                <Text style={styles.menuInfoText}>• AI 피부 분석</Text>
                <Text style={styles.menuInfoText}>• 전문가 상담</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3f0',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  headerBackground: {
    backgroundColor: '#6b8e6f',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 34,
  },
  mainCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 16,
    elevation: 4,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cardSection: {
    marginBottom: 24,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  skinTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  skinTypeButton: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  skinTypeButtonSelected: {
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  skinTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  skinTypeButtonTextSelected: {
    color: '#fff',
  },
  
  preferencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  preferenceButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceButtonSelected: {
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  preferenceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  preferenceButtonTextSelected: {
    color: '#fff',
  },
  
  buttonSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  getRecommendationButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#d4af8f',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4af8f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
  },
  getRecommendationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  getRecommendationButtonDisabled: {
    opacity: 0.6,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
    backgroundColor: '#6b8e6f',
  },
  chatHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatHeaderSubtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6b8e6f',
    borderColor: '#6b8e6f',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f1f1',
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  productsSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  productsScroll: {
    paddingVertical: 8,
  },
  productCard: {
    width: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    elevation: 2,
  },
  productImageContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  placeholderText: {
    fontSize: 24,
    color: '#aaa',
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  productBrand: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  rating: {
    fontSize: 12,
    color: '#f39c12',
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#6b8e6f',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8f4',
    borderRadius: 8,
    elevation: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#6b8e6f',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#6b8e6f',
    marginLeft: 8,
    shadowColor: '#6b8e6f',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#a8c9a8',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  glossShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '25%',
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    pointerEvents: 'none',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 24,
  },
  
  // 슬라이드 메뉴 스타일
  slideMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.85,
    height: '100%',
    backgroundColor: '#fff',
    elevation: 8,
    zIndex: 10,
    paddingTop: 16,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  menuTabButtons: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginVertical: 12,
    gap: 6,
  },
  menuTabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  menuTabButtonActive: {
    backgroundColor: '#6b8e6f',
  },
  menuTabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  menuTabButtonTextActive: {
    color: '#fff',
  },
  menuTabContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuTabPanel: {
    paddingVertical: 16,
  },
  menuPanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  menuPanelDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  menuPanelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuPanelButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPanelButtonSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  menuPanelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  menuInfoBox: {
    backgroundColor: '#f9f7ff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  menuInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  menuInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    lineHeight: 16,
  },
});