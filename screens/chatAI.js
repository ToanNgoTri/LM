import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Animated,
  FlatList,
  Easing,
  Platform,
  StatusBar,
  Dimensions,
  Vibration
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '../hooks/useTabBarHeight';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_URL = 'https://us-central1-project2-197c0.cloudfunctions.net/askLawAI';

const INITIAL_MESSAGES = [
  {
    id: '0',
    role: 'assistant',
    text: 'Xin chào! Tôi là trợ lý tư vấn pháp luật AI. Bạn có thể hỏi tôi bất kỳ điều gì về pháp luật Việt Nam.',
    timestamp: new Date(Date.now() - 60000),
  },
];

const formatTime = date => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const TypingIndicator = memo(() => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingDots}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
});

const MessageBubble = memo(({ item }) => {
  const isUser = item.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
          ]}
        >
          {item.text}
        </Text>
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.timestampUser : styles.timestampAssistant,
          ]}
        >
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
});

export const AIChatScreen = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const xhrRef = useRef(null);
  const charQueueRef = useRef([]);       // hàng đợi ký tự chờ render
  const charTimerRef = useRef(null);     // setTimeout đang chạy
  const assistantIdRef = useRef(null);   // id message AI hiện tại

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  // Ref ổn định: giữ flatListRef nội bộ + expose global.AIChatRef để nhấn lần 2
  // vào bottom tab "Chat AI" cuộn lên đầu.
  const setListRef = useCallback(ref => {
    flatListRef.current = ref;
    global.AIChatRef = ref;
  }, []);
  useEffect(() => () => {
    global.AIChatRef = null;
  }, []);

  const charCountRef = useRef(0);

  // Xử lý từng ký tự từ queue với setTimeout — rung theo từng char
const scheduleNextChar = useCallback(() => {
  if (charQueueRef.current.length === 0) {
    charTimerRef.current = null;
    return;
  }

  const char = charQueueRef.current.shift();
  const id = assistantIdRef.current;

  Vibration.vibrate(6);

  setMessages(prev =>
    prev.map(msg =>
      msg.id === id ? { ...msg, text: msg.text + char } : msg,
    ),
  );

  // Auto-scroll mỗi 5 ký tự để không gọi quá nhiều
  charCountRef.current = (charCountRef.current || 0) + 1;
  if (charCountRef.current % 5 === 0) {
    flatListRef.current?.scrollToEnd({ animated: false });
  }

  charTimerRef.current = setTimeout(scheduleNextChar, 8);
}, []);


  const enqueueChunk = useCallback((chunk) => {
    charQueueRef.current.push(...chunk.split(''));
    // Chỉ khởi động timer nếu chưa chạy
    if (!charTimerRef.current) {
      charTimerRef.current = setTimeout(scheduleNextChar, 0);
    }
  }, [scheduleNextChar]);

  const streamAIResponse = useCallback((userText, history) => {
    setIsTyping(true);
    setIsStreaming(true);
    charQueueRef.current = [];
    charTimerRef.current = null;
    charCountRef.current = 0; // ← thêm

    const assistantId = `ai-${Date.now()}`;
    assistantIdRef.current = assistantId;
    let firstChunk = true;
    let processedLength = 0;

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('POST', API_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = () => {
      if (xhr.readyState < 3) return;

      if (xhr.status !== 200 && xhr.readyState === 4) {
        if (charTimerRef.current) {
          clearTimeout(charTimerRef.current);
          charTimerRef.current = null;
        }
        charQueueRef.current = [];
        setIsTyping(false);
        setIsStreaming(false);
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: `Lỗi server: HTTP ${xhr.status}`,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const newText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;

      const lines = newText.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

try {
  const json = JSON.parse(data);

  // Lỗi từ server (rate limit, timeout...) → hiển thị ra bubble
  if (json.error) {
    setIsTyping(false);
    setIsStreaming(false);
    if (charTimerRef.current) {
      clearTimeout(charTimerRef.current);
      charTimerRef.current = null;
    }
    charQueueRef.current = [];
    setMessages(prev => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: json.error.includes('rate limit') || json.error.includes('Rate limit')
          ? 'Hệ thống đang bận, vui lòng thử lại sau ít phút.'
          : `Có lỗi xảy ra: ${json.error}`,
        timestamp: new Date(),
      },
    ]);
    return;
  }

  const chunk = json.text;
  if (!chunk) continue;

  if (firstChunk) {
    setIsTyping(false);
    firstChunk = false;
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        timestamp: new Date(),
      },
    ]);
    scrollToBottom();
    enqueueChunk(chunk);
  } else {
    enqueueChunk(chunk);
  }
} catch (_) {}
      }

      if (xhr.readyState === 4) {
        // Đợi queue xử lý hết rồi mới tắt streaming
        const waitQueue = () => {
          if (charQueueRef.current.length > 0 || charTimerRef.current) {
            setTimeout(waitQueue, 50);
          } else {
            setIsTyping(false);
            setIsStreaming(false);
          }
        };
        waitQueue();
      }
    };

    xhr.onerror = () => {
      if (charTimerRef.current) clearTimeout(charTimerRef.current);
      charQueueRef.current = [];
      setIsTyping(false);
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Không thể kết nối đến server. Kiểm tra lại mạng.',
          timestamp: new Date(),
        },
      ]);
    };

    xhr.ontimeout = () => {
      if (charTimerRef.current) clearTimeout(charTimerRef.current);
      charQueueRef.current = [];
      setIsTyping(false);
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Hết thời gian chờ. Thử lại sau.',
          timestamp: new Date(),
        },
      ]);
    };

    xhr.timeout = 60000;
    xhr.send(JSON.stringify({ question: userText, history }));
  }, [enqueueChunk, scrollToBottom]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    Keyboard.dismiss();
    setInputText('');

    const history = messages
      .filter(m => m.id !== '0')
      .map(m => ({ role: m.role, content: m.text }));

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();
    streamAIResponse(text, history);
  }, [inputText, isStreaming, messages, streamAIResponse, scrollToBottom]);

  const renderMessage = useCallback(
    ({ item }) => <MessageBubble item={item} />,
    [],
  );
  const keyExtractor = useCallback(item => item.id, []);

  const ListFooter = useCallback(
    () => (
      <>
        {isTyping && (
          <View style={styles.messageRow}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <TypingIndicator />
          </View>
        )}
        <View style={{ height: 12 }} />
      </>
    ),
    [isTyping],
  );

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: tabBarHeight },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0D0D14" />

      <View style={styles.inputBar}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập câu hỏi pháp luật..."
            placeholderTextColor="#4A4A68"
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
            editable={!isStreaming}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              inputText.trim() && !isStreaming
                ? styles.sendBtnActive
                : styles.sendBtnInactive,
            ]}
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={!inputText.trim() || isStreaming}
          >
            <Ionicons
              name="arrow-down"
              size={18}
              color={inputText.trim() && !isStreaming ? '#fff' : '#3A3A58'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerDivider} />

      <FlatList
        ref={setListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={Keyboard.dismiss}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D14' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0D0D14',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  headerTitle: {
    color: '#F0F0FA',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252540',
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22D3A0',
  },
  streamingText: { color: '#22D3A0', fontSize: 11, fontWeight: '500' },

  headerDivider: { height: 1, backgroundColor: '#1E1E30' },

  listContent: { paddingHorizontal: 16, paddingTop: 12 },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#6C63FF', borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#252540',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAssistant: { color: '#E0E0F4' },
  timestamp: { fontSize: 10, marginTop: 5 },
  timestampUser: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  timestampAssistant: { color: '#404060' },

  typingBubble: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#252540',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6C63FF' },

  inputBar: {
    backgroundColor: '#0D0D14',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#13131F',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#252540',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: '#E8E8FA',
    fontSize: 14.5,
    lineHeight: 20,
    maxHeight: 110,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  sendBtnInactive: { backgroundColor: '#1A1A2E' },
});