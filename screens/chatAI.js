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
  Vibration,
  Alert,
  AppState
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { useSubscription } from '../subscription/SubscriptionContext';
import { PaywallModal } from '../subscription/PaywallModal';
import MicButton from './components/MicButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Chiều cao hàng tiêu đề nổi (avatar 40 + đệm trên/dưới). Danh sách nằm DƯỚI
// tiêu đề nên phải tự chừa đúng bấy nhiêu ở phần đệm trên.
const TOP_BAR_HEIGHT = 58;
// Đoạn nền loang từ đặc về trong suốt ở dưới hàng tiêu đề. Chữ chạy vào đây là
// mờ dần chứ không bị cắt ngang một nhát.
const HEADER_FADE = 36;
// Chiều cao thanh nhập lúc chỉ có một dòng — CHỈ dùng làm giá trị tạm cho lần
// dựng đầu tiên; sau đó lấy số đo thật qua onLayout, vì hộp cao lên khi câu hỏi
// dài xuống nhiều dòng.
const INPUT_BAR_HEIGHT = 64;
// Khe hở giữa dòng chữ cuối và mép trên hộp nhập.
const INPUT_BAR_GAP = 10;

const API_URL = 'https://us-central1-project2-197c0.cloudfunctions.net/askLawAI';
// Lấy lại câu trả lời mà server vẫn sinh tiếp khi app bị HĐH tạm dừng (user out
// ra app khác). Xem functions/index.js -> getLawAIAnswer.
const ANSWER_URL =
  'https://us-central1-project2-197c0.cloudfunctions.net/getLawAIAnswer';
// Nhịp hỏi lại server khi câu trả lời còn đang được sinh.
const RESUME_POLL_MS = 1500;
// Trần chờ khi resume (~90s) — đủ cho một câu dài, tránh hỏi vô hạn.
const RESUME_MAX_POLLS = 60;
// Sau khi user mở lại app, chờ bấy nhiêu ms rồi mới kiểm tra stream còn sống?
const ZOMBIE_CHECK_MS = 3000;
// Cứ bấy nhiêu ký tự stream ra thì rung một nhịp — rung thưa cho đỡ rối tay.
const VIBRATE_EVERY_CHARS = 8;
// Tốc độ GÕ mong muốn: 14ms cho mỗi ký tự (~70 ký tự/giây) — đủ thong thả để
// mắt đọc theo kịp. Đây chỉ là tốc độ hiển thị, KHÔNG còn là nhịp vẽ lại.
//
// Đo trên máy thật: một lần vẽ tốn ~40ms ở luồng giao diện, còn setTimeout của
// RN thì khoá theo khung hình nên không bao giờ về sớm hơn ~17ms. Vẽ từng ký tự
// một vì thế tự đặt trần ~18 ký tự/giây, dù phần JS chỉ tốn 0,4ms. Gộp nhiều ký
// tự vào chung một lần vẽ thì cùng ngần ấy công mà chữ chạy đúng tốc độ.
const MS_PER_CHAR = 14;
// Trần ký tự cho mỗi lần vẽ, để lúc app vừa chạy lại sau một quãng dài không
// đổ ụp cả đoạn ra màn hình.
const MAX_CHARS_PER_FLUSH = 24;

// jobId: server dùng làm _id của job -> phải khớp /^[A-Za-z0-9_-]{8,64}$/.
const makeJobId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Chuyển payload lỗi của server thành câu chữ cho người dùng. Dùng chung cho cả
// lúc đang stream và lúc resume, để hai đường không bao giờ nói khác nhau.
// Model không dùng được (hết lượt / bị khai tử / hết credit / quá tải): luôn quy
// về thông báo nâng cấp, KHÔNG bao giờ hiện lỗi kỹ thuật thô của OpenRouter.
// Regex là lưới an toàn cho trường hợp server chưa deploy bản mới (bản cũ trả
// nguyên văn message 404 "unavailable...").
const buildServerErrorText = ({ error, code }, { isPremium, usingTrial }) => {
  const raw = String(error || '');
  // Dịch vụ phụ trợ (máy embed / DB) chết -> không liên quan gì tới gói cước,
  // đừng mời nâng cấp. Server bản mới gửi kèm code này.
  if (code === 'SERVICE_UNAVAILABLE') {
    return raw || 'Hệ thống tra cứu tạm thời gián đoạn, vui lòng thử lại sau ít phút.';
  }
  // Model nhận request nhưng không sinh ra chữ nào (:free hết lượt / tạm ngừng).
  // KHÔNG dùng lời "đã dùng hết lượt" của nhánh RATE_LIMIT vì ở đây lượt chưa
  // hề bị trừ — model có trả lời, chỉ là trả về rỗng.
  if (code === 'MODEL_BUSY') {
    return isPremium
      ? 'Máy chủ AI đang bận, vui lòng thử lại sau ít phút.'
      : 'Máy chủ AI đang bận. Vui lòng nâng cấp để sử dụng đầy đủ tính năng.';
  }
  // Lưới an toàn: lỗi kỹ thuật thô của JS/hạ tầng (server bản cũ gửi thẳng
  // err.message, ví dụ "Unexpected token 'e' ... is not valid JSON") không bao
  // giờ được hiện nguyên văn cho người dùng.
  if (
    /is not valid JSON|Unexpected token|SyntaxError|TypeError|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|undefined/i.test(
      raw,
    )
  ) {
    return 'Hệ thống tra cứu tạm thời gián đoạn, vui lòng thử lại sau ít phút.';
  }
  const isRateLimit =
    code === 'RATE_LIMIT' ||
    /rate ?limit|unavailable|no endpoints|not found|quota|insufficient|credit|\b40[0234]\b|\b429\b|\b5\d{2}\b/i.test(
      raw,
    );
  // Chỉ người ĐÃ MUA mới nhận thông báo "quá tải"; còn lại luôn mời nâng cấp.
  // Không dùng cờ upgrade của server: trạng thái mua thật nằm ở client.
  if (isRateLimit && !isPremium) {
    return usingTrial
      ? // Còn lượt dùng thử -> không nói "đã dùng hết lượt" (sai sự thật), và
        // lượt dùng thử cũng chưa bị trừ vì câu trả lời không về được.
        'Các model miễn phí hiện không khả dụng. Vui lòng nâng cấp bản có phí để sử dụng AI ổn định.'
      : 'Bạn đã dùng hết lượt của model miễn phí. Vui lòng nâng cấp bản có phí để tiếp tục sử dụng AI.';
  }
  if (isRateLimit) return 'Các model AI đang quá tải, vui lòng thử lại sau ít phút.';
  return `Có lỗi xảy ra: ${raw}`;
};

// Lời chào mở đầu. Dùng hàm (không dùng const cố định) để khi bấm "làm mới"
// khung chat thì timestamp cũng là thời điểm hiện tại. Giữ id '0' vì handleSend
// loại message này ra khỏi history gửi lên server.
const makeInitialMessages = () => [
  {
    id: '0',
    role: 'assistant',
    text: 'Xin chào! Tôi là trợ lý tra cứu pháp luật AI. Bạn có thể hỏi tôi bất kỳ điều gì về pháp luật Việt Nam.',
    timestamp: new Date(),
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

const MessageBubble = memo(({ item, onCopy }) => {
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
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => onCopy?.(item.text)}
        delayLongPress={250}
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
        <View style={styles.bubbleFooter}>
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.timestampUser : styles.timestampAssistant,
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
          {!isUser && !!item.text && (
            <TouchableOpacity
              onPress={() => onCopy?.(item.text)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.copyBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="copy-outline" size={13} color="#7A7A9C" />
              <Text style={styles.copyBtnText}>Sao chép</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export const AIChatScreen = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const {
    isPremium,
    planLabel,
    expiryDate,
    canUsePremium,
    trialRemaining,
    trialTotal,
    consumeTrial,
  } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  // Ref để streamAIResponse luôn đọc được trạng thái premium mới nhất
  // mà không cần đưa isPremium vào dependency của useCallback.
  const isPremiumRef = useRef(isPremium);
  useEffect(() => {
    isPremiumRef.current = isPremium;
  }, [isPremium]);

  // Đang dùng lượt dùng thử (chưa mua nhưng vẫn được gọi model premium).
  const canUsePremiumRef = useRef(canUsePremium);
  const usingTrialRef = useRef(false);
  useEffect(() => {
    canUsePremiumRef.current = canUsePremium;
    usingTrialRef.current = !isPremium && trialRemaining > 0;
  }, [canUsePremium, isPremium, trialRemaining]);
  const consumeTrialRef = useRef(consumeTrial);
  useEffect(() => {
    consumeTrialRef.current = consumeTrial;
  }, [consumeTrial]);

  const [messages, setMessages] = useState(makeInitialMessages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const xhrRef = useRef(null);
  const charQueueRef = useRef([]);       // hàng đợi ký tự chờ render
  const charTimerRef = useRef(null);     // setTimeout đang chạy
  const assistantIdRef = useRef(null);   // id message AI hiện tại

  // ---- Xử lý trường hợp user out ra app khác giữa lúc AI đang trả lời -------
  // Khi app xuống background, HĐH đóng băng JS và thường ngắt luôn kết nối HTTP
  // đang mở. Lúc quay lại app, xhr bắn onerror/ontimeout ngay → trước đây hiện
  // "Kiểm tra lại mạng" dù mạng user vẫn bình thường. Các ref dưới đây cho phép
  // phân biệt lỗi mạng thật với việc app bị tạm dừng.
  const isStreamingRef = useRef(false);
  const leftAppDuringStreamRef = useRef(false);
  const wentBackgroundRef = useRef(false);  // đã xuống background thật (không chỉ 'inactive')
  const lastRequestRef = useRef(null);      // { userText, history } câu đang chờ
  const autoRetryRef = useRef(0);           // số lần đã tự gửi lại cho câu này
  const pendingRetryRef = useRef(null);     // retry đang chờ app quay lại foreground
  const streamAIResponseRef = useRef(null); // để retry gọi lại chính nó
  const requestSeqRef = useRef(0);          // vô hiệu retry của request đã cũ
  const lastChunkAtRef = useRef(0);         // lúc nhận chunk gần nhất
  const forceResumeRef = useRef(null);      // cắt stream zombie, lấy từ server

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    // 'inactive' (iOS) cũng tính là rời app: có máy bắn inactive rồi mới
    // background, và JS có thể bị đóng băng trước khi kịp nhận 'background'.
    const sub = AppState.addEventListener('change', next => {
      if ((next === 'background' || next === 'inactive') && isStreamingRef.current) {
        leftAppDuringStreamRef.current = true;
        if (next === 'background') wentBackgroundRef.current = true;
      }
      if (next !== 'active') return;

      // Chỉ lần rời app THẬT mới được phép cắt stream (xem dưới). Gián đoạn kiểu
      // 'inactive' (banner thông báo, kéo control center) không đóng băng JS nên
      // kết nối vẫn tốt — cắt là phí.
      const wasBackgrounded = wentBackgroundRef.current;
      wentBackgroundRef.current = false;

      // Việc lấy câu trả lời đã bị hoãn vì lúc đó app còn ở background (gọi
      // mạng trong background cũng lỗi) -> làm ngay khi user vừa mở lại app.
      if (pendingRetryRef.current) {
        const resume = pendingRetryRef.current;
        pendingRetryRef.current = null;
        setTimeout(resume, 300);
        return;
      }

      // Kết nối "zombie": HĐH đã bỏ rơi socket nhưng không bắn lỗi, nên xhr cứ
      // im tới lúc timeout 60s. Đừng để user ngồi nhìn 3 dấu chấm suốt 60s:
      // chờ 3s xem stream có chảy tiếp không, nếu không thì cắt và lấy câu trả
      // lời từ server (server vẫn sinh tiếp nên không mất gì).
      if (wasBackgrounded && isStreamingRef.current) {
        const returnedAt = Date.now();
        setTimeout(() => {
          if (!isStreamingRef.current) return;
          // Có chunk về SAU khi quay lại app -> kết nối còn sống, để nguyên.
          if (lastChunkAtRef.current > returnedAt) return;
          forceResumeRef.current?.();
        }, ZOMBIE_CHECK_MS);
      }
    });
    return () => sub.remove();
  }, []);

  // Chỉ rung khi màn hình Chat AI đang được focus (không rung khi user đã
  // chuyển sang tab/màn khác trong lúc AI vẫn đang stream). Dùng ref để
  // scheduleNextChar (useCallback deps rỗng) luôn đọc được giá trị mới nhất.
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Cho phép auto-scroll xuống đáy khi đang stream. Khi user tự cuộn lên trên
  // (rời khỏi đáy) -> tắt; khi user cuộn về sát đáy -> bật lại.
  const autoScrollRef = useRef(true);
  // true khi cú cuộn HIỆN TẠI là do user (kéo tay/quán tính), false khi là do
  // code gọi scrollToEnd. Chỉ cho phép cử chỉ của user TẮT auto-scroll — cuộn
  // do code (lúc push/stream) không bao giờ tự tắt -> tránh race khi câu trả
  // lời về nhanh làm animation dừng chưa tới đáy.
  const userScrollingRef = useRef(false);
  // Chiều cao nội dung gần nhất FlatList báo về.
  const contentHeightRef = useRef(0);
  // Chiều cao khung nhìn của FlatList.
  const listHeightRef = useRef(0);
  // Offset đáy THẬT = nội dung - khung nhìn. Không được dùng thẳng chiều cao nội
  // dung: iOS không tự kẹp offset nên sẽ cuộn vượt đáy cả một màn hình, chỉ còn
  // lại khoảng trống.
  const bottomOffset = () =>
    Math.max(0, contentHeightRef.current - listHeightRef.current);

  const scrollToBottom = useCallback((animated = true) => {
    autoScrollRef.current = true;
    // Cờ "user đang tự cuộn" chỉ được xoá ở sự kiện KẾT THÚC cuộn. Thả tay xong
    // mà bàn phím bật lên nuốt mất sự kiện đó thì cờ kẹt lại true, và ngay sau
    // đó handleScroll sẽ tắt auto-scroll trở lại. Xoá tay ở đây.
    userScrollingRef.current = false;
    const jump = () =>
      flatListRef.current?.scrollToOffset({
        offset: bottomOffset(),
        animated,
      });
    jump();
    setTimeout(jump, 120);
    setTimeout(jump, 320);
  }, []);

  // Vị trí cuộn quyết định auto-scroll:
  //  - về sát đáy (<=80px)      -> luôn bật lại (kể cả sau khi push)
  //  - rời đáy DO user tự cuộn  -> tắt
  //  - rời đáy do code cuộn     -> giữ nguyên (không tắt)
  const handleScroll = useCallback(e => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom <= 80) {
      autoScrollRef.current = true;
    } else if (userScrollingRef.current) {
      autoScrollRef.current = false;
    }
  }, []);

  // Đánh dấu cú cuộn đang do user điều khiển (kéo tay + quán tính sau khi thả).
  const handleScrollBeginDrag = useCallback(() => {
    userScrollingRef.current = true;
    Keyboard.dismiss();
  }, []);
  const handleUserScrollActive = useCallback(() => {
    userScrollingRef.current = true;
  }, []);
  const handleUserScrollIdle = useCallback(() => {
    userScrollingRef.current = false;
  }, []);

  // Nội dung vừa cao lên và ĐÃ đo xong -> đây là lúc duy nhất biết chắc đáy nằm
  // ở đâu. Dùng chiều cao FlatList vừa báo chứ không gọi scrollToEnd (hàm đó
  // đọc lại số đo có thể còn cũ).
  const handleContentSizeChange = useCallback((_w, h) => {
    // Ghi TRƯỚC khi kiểm tra auto-scroll: user cuộn lên đọc lại thì vẫn phải
    // biết đáy nằm ở đâu, không thì lúc bấm gửi sẽ nhảy về một số cũ mèm.
    contentHeightRef.current = h;
    if (!autoScrollRef.current) return;
    flatListRef.current?.scrollToOffset({
      offset: bottomOffset(),
      animated: false,
    });
  }, []);

  // Bàn phím đóng lại làm KHUNG NHÌN cao lên, nhưng chiều cao nội dung không
  // đổi nên onContentSizeChange im lặng. Không bắt thêm ở đây thì cụm "đang suy
  // nghĩ" nằm lại dưới hộp nhập.
  const handleListLayout = useCallback(e => {
    listHeightRef.current = e.nativeEvent.layout.height;
    if (!autoScrollRef.current) return;
    flatListRef.current?.scrollToOffset({
      offset: bottomOffset(),
      animated: false,
    });
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
  // Mốc thời gian lần vẽ trước, để biết quãng vừa rồi đáng lẽ gõ được mấy ký tự.
  const lastFlushAtRef = useRef(0);
  // Số ký tự tại lần rung gần nhất.
  const lastVibrateAtRef = useRef(0);

  // Xử lý từng ký tự từ queue với setTimeout — rung thưa theo cụm ký tự
const scheduleNextChar = useCallback(() => {
  const queue = charQueueRef.current;
  if (queue.length === 0) {
    charTimerRef.current = null;
    lastFlushAtRef.current = 0;
    return;
  }

  // Lấy ra đúng số ký tự ĐÁNG LẼ đã gõ xong trong quãng vừa trôi qua, thay vì
  // cứng nhắc một ký tự mỗi lần. Nhịp vẽ chậm bao nhiêu thì mỗi lần lấy nhiều
  // bấy nhiêu, nên tốc độ chữ chạy không còn phụ thuộc vào máy nhanh hay chậm.
  const now = Date.now();
  const elapsed = lastFlushAtRef.current
    ? now - lastFlushAtRef.current
    : MS_PER_CHAR;
  lastFlushAtRef.current = now;

  const take = Math.min(
    queue.length,
    MAX_CHARS_PER_FLUSH,
    Math.max(1, Math.round(elapsed / MS_PER_CHAR)),
  );
  const chunk = queue.splice(0, take).join('');
  const id = assistantIdRef.current;

  charCountRef.current = (charCountRef.current || 0) + take;

  // Chỉ rung khi đang ở màn hình Chat AI, và rung thưa (mỗi VIBRATE_EVERY_CHARS
  // ký tự) để tránh cảm giác rung liên tục khi stream. Đếm theo mốc chứ không
  // theo phép chia hết: một lần vẽ giờ nuốt nhiều ký tự nên mốc chia hết có thể
  // bị nhảy qua, trước đây chính chỗ này làm mất hẳn rung.
  if (
    isFocusedRef.current &&
    charCountRef.current - lastVibrateAtRef.current >= VIBRATE_EVERY_CHARS
  ) {
    lastVibrateAtRef.current = charCountRef.current;
    Vibration.vibrate(6);
  }

  setMessages(prev =>
    prev.map(msg =>
      msg.id === id ? { ...msg, text: msg.text + chunk } : msg,
    ),
  );

  // KHÔNG cuộn ở đây. Vòng lặp này chạy 8ms/ký tự, mà lúc nó gọi thì chữ vừa
  // thêm còn CHƯA layout xong -> scrollToEnd nhắm vào chiều cao nội dung cũ và
  // vĩnh viễn đuổi không kịp, chữ mới trôi xuống dưới hộp nhập. Việc cuộn dời
  // sang onContentSizeChange của FlatList: ở đó chiều cao là số thật, và mỗi
  // lần layout chỉ cuộn một lần thay vì 25 lần/giây.

  charTimerRef.current = setTimeout(scheduleNextChar, MS_PER_CHAR);
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
    charCountRef.current = 0;
    lastFlushAtRef.current = 0;
    lastVibrateAtRef.current = 0;

    const assistantId = `ai-${Date.now()}`;
    assistantIdRef.current = assistantId;
    let firstChunk = true;
    let processedLength = 0;

    // Toàn bộ chữ đã nhận được cho câu trả lời này (kể cả phần còn trong queue
    // chờ render). Dùng khi resume để biết còn thiếu bao nhiêu.
    let received = '';

    // Lượt dùng thử chỉ bị trừ khi câu trả lời thật sự bắt đầu về (lỗi mạng /
    // rate limit thì không mất lượt). Cờ này đảm bảo mỗi câu chỉ trừ 1 lần.
    let trialEndedNotice = false; // true nếu lượt vừa trừ là lượt cuối
    const spendTrialOnce = (() => {
      let charged = false;
      return () => {
        if (charged || isPremiumRef.current || !usingTrialRef.current) {
          return Promise.resolve();
        }
        charged = true;
        return Promise.resolve(consumeTrialRef.current?.())
          .then(remaining => {
            if (remaining === 0) trialEndedNotice = true;
          })
          .catch(() => {});
      };
    })();

    isStreamingRef.current = true;
    const mySeq = ++requestSeqRef.current;
    // Mỗi câu hỏi một jobId: server ghi câu trả lời vào job đó, app quay lại thì
    // lấy về bằng jobId này thay vì bắt AI sinh lại từ đầu.
    const jobId = makeJobId();
    lastRequestRef.current = { userText, history };

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('POST', API_URL);
    xhr.setRequestHeader('Content-Type', 'application/json');

    const pushBubble = text => {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text,
          timestamp: new Date(),
        },
      ]);
      scrollToBottom();
    };

    // Vừa dùng hết lượt dùng thử -> nói rõ từ giờ chuyển sang bản Free.
    const pushTrialEndedNoticeIfNeeded = () => {
      if (!trialEndedNotice) return;
      trialEndedNotice = false;
      setMessages(prev => [
        ...prev,
        {
          id: `trial-${Date.now()}`,
          role: 'assistant',
          text: 'Bạn đã dùng hết lượt dùng thử Premium. Các câu hỏi tiếp theo sẽ dùng model miễn phí. Nâng cấp bản có phí để tiếp tục dùng model chất lượng cao.',
          timestamp: new Date(),
        },
      ]);
      scrollToBottom();
    };

    const stopStreamingState = () => {
      setIsTyping(false);
      setIsStreaming(false);
      isStreamingRef.current = false;
    };

    // Giữ trạng thái "AI đang trả lời" (3 dấu chấm + khoá nút gửi) trong lúc chờ
    // lấy câu trả lời từ server, để user không tưởng câu hỏi bị mất.
    const keepStreamingState = () => {
      setIsTyping(true);
      setIsStreaming(true);
      isStreamingRef.current = true;
    };

    // Đặt nguyên văn câu trả lời lấy từ server vào bubble. Server là nguồn đúng
    // nhất (phần app đã hiện chỉ là tiền tố của nó) nên ghi đè thẳng, không cộng
    // dồn -> không bao giờ bị lặp chữ.
    const applyAnswerText = (full, done) => {
      if (full) {
        if (firstChunk) {
          firstChunk = false;
          setMessages(prev => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              text: full,
              timestamp: new Date(),
            },
          ]);
        } else {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId ? { ...msg, text: full } : msg,
            ),
          );
        }
        received = full;
        setIsTyping(false);
        // Câu trả lời về thật (dù qua đường resume) -> vẫn tính lượt dùng thử.
        spendTrialOnce().then(() => {
          if (done) pushTrialEndedNoticeIfNeeded();
        });
        scrollToBottom();
      }
      if (done) stopStreamingState();
    };

    // Lấy câu trả lời từ job trên server — dùng khi kết nối stream đã chết vì
    // app bị HĐH tạm dừng. Trả về true nếu đã xử lý xong (có câu trả lời hoặc
    // có lỗi đã báo cho user), false nếu server không giữ được job và cần gửi
    // lại câu hỏi.
    const resumeFromServer = async () => {
      let netFails = 0;
      for (let i = 0; i < RESUME_MAX_POLLS; i++) {
        if (requestSeqRef.current !== mySeq) return true; // đã có câu hỏi mới

        let data = null;
        try {
          const r = await fetch(ANSWER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          });
          // 404/405 = endpoint chưa được deploy -> bỏ hẳn đường resume, đừng
          // bắt user chờ hết vòng poll.
          if (r.status === 404 || r.status === 405) return false;
          data = await r.json();
          netFails = 0;
        } catch (_) {
          // Mạng lỗi ngay lúc này -> chưa kết luận mất job, thử lại nhịp sau.
          // Nhưng lỗi liên tiếp thì thôi, để caller xử lý như lỗi mạng.
          netFails += 1;
          if (netFails >= 3) return false;
        }
        if (requestSeqRef.current !== mySeq) return true;

        if (data?.status === 'done') {
          if (!data.text) return false; // job rỗng -> để caller gửi lại
          applyAnswerText(data.text, true);
          return true;
        }
        if (data?.status === 'error') {
          stopStreamingState();
          pushBubble(
            buildServerErrorText(data, {
              isPremium: isPremiumRef.current,
              usingTrial: usingTrialRef.current,
            }),
          );
          return true;
        }
        if (data?.status === 'unknown') return false; // server không có job này

        // 'running': hiện ngay phần server đã sinh được rồi chờ nhịp sau.
        if (data?.text && data.text.length > received.length) {
          applyAnswerText(data.text, false);
        }
        await new Promise(r => setTimeout(r, RESUME_POLL_MS));
      }
      return false; // chờ quá lâu -> để caller quyết định
    };

    // Dừng stream vì lỗi. onerror và ontimeout dùng chung, và cùng phải phân
    // biệt "mạng user có vấn đề" với "app vừa bị HĐH tạm dừng vì user out ra
    // app khác" — hai chuyện rất khác nhau với người dùng.
    const failStream = fallbackText => {
      if (charTimerRef.current) {
        clearTimeout(charTimerRef.current);
        charTimerRef.current = null;
      }
      // Đổ phần chữ còn nằm trong queue vào bubble trước khi dừng: đã tải được
      // thì không có lý gì làm mất đoạn cuối.
      const pending = charQueueRef.current.join('');
      charQueueRef.current = [];
      if (!firstChunk && pending) {
        const id = assistantIdRef.current;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === id ? { ...msg, text: msg.text + pending } : msg,
          ),
        );
      }
      stopStreamingState();

      // Request này đã bị thay bằng request mới (user hỏi câu khác / làm mới
      // khung chat) -> không báo lỗi của một câu đã không còn ai chờ.
      if (requestSeqRef.current !== mySeq) return;

      if (leftAppDuringStreamRef.current) {
        // Reset ngay: nếu cả resume lẫn gửi lại đều thất bại thì đó mới là lỗi
        // mạng thật và phải hiện thông báo bình thường.
        leftAppDuringStreamRef.current = false;

        // Server vẫn sinh tiếp câu trả lời dù kết nối đã đứt -> lấy về thay vì
        // bắt AI làm lại từ đầu.
        keepStreamingState();

        const resumeThenMaybeRetry = async () => {
          const handled = await resumeFromServer();
          if (handled || requestSeqRef.current !== mySeq) return;

          // Server không giữ được câu trả lời (job hết hạn / chưa kịp tạo) và
          // app cũng chưa nhận được chữ nào -> gửi lại 1 lần cho user đỡ phải
          // gõ lại câu hỏi.
          if (firstChunk && autoRetryRef.current < 1 && lastRequestRef.current) {
            autoRetryRef.current += 1;
            const { userText: q, history: h } = lastRequestRef.current;
            streamAIResponseRef.current?.(q, h);
            return;
          }

          stopStreamingState();
          pushBubble(
            firstChunk
              ? fallbackText
              : // Đã hiện được một phần: giữ nguyên phần đó, nói rõ là bị ngắt
                // giữa dòng thay vì bắt user đi kiểm tra mạng.
                'Câu trả lời bị ngắt vì ứng dụng tạm dừng khi bạn chuyển sang app khác. Bạn có thể hỏi lại để xem đầy đủ nội dung.',
          );
        };

        if (AppState.currentState === 'active') {
          resumeThenMaybeRetry();
        } else {
          // Gọi mạng lúc app còn ở background gần như chắc chắn lỗi: chờ user mở
          // lại app rồi mới hỏi server.
          pendingRetryRef.current = resumeThenMaybeRetry;
        }
        return;
      }

      pushBubble(fallbackText);
    };

    // Cắt kết nối zombie (xem AppState listener) và đi thẳng vào nhánh lấy câu
    // trả lời từ server. abort() không bắn onerror nên phải gọi failStream tay.
    forceResumeRef.current = () => {
      if (requestSeqRef.current !== mySeq) return;
      try {
        xhr.abort();
      } catch (_) {}
      leftAppDuringStreamRef.current = true; // ép đi vào nhánh resume
      failStream('Không thể kết nối đến server. Kiểm tra lại mạng.');
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState < 3) return;

      if (xhr.status !== 200 && xhr.readyState === 4) {
        // status 0 = kết nối lỗi / timeout / bị abort. Để onerror/ontimeout/
        // onabort xử lý (chỉ chúng phân biệt được app-xuống-background với lỗi
        // mạng thật), nếu không sẽ hiện thêm bubble "Lỗi server: HTTP 0" vô nghĩa.
        if (xhr.status === 0) return;

        if (charTimerRef.current) {
          clearTimeout(charTimerRef.current);
          charTimerRef.current = null;
        }
        charQueueRef.current = [];
        setIsTyping(false);
        setIsStreaming(false);
        isStreamingRef.current = false;
        pushBubble(`Lỗi server: HTTP ${xhr.status}`);
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
    stopStreamingState();
    if (charTimerRef.current) {
      clearTimeout(charTimerRef.current);
      charTimerRef.current = null;
    }
    charQueueRef.current = [];

    // Chỉ báo bằng bubble trong khung chat: không alert, không tự mở màn hình
    // thanh toán. Muốn mua thì user tự bấm pill "Nâng cấp" ở thanh trên.
    // pushBubble luôn cuộn xuống, kể cả khi user đang cuộn lên trên đọc lại —
    // nếu không thì bubble cảnh báo nằm dưới màn hình và user không thấy gì.
    pushBubble(
      buildServerErrorText(json, {
        isPremium: isPremiumRef.current,
        usingTrial: usingTrialRef.current,
      }),
    );
    return;
  }

  const chunk = json.text;
  if (!chunk) continue;
  received += chunk;
  lastChunkAtRef.current = Date.now();

  if (firstChunk) {
    setIsTyping(false);
    firstChunk = false;
    spendTrialOnce();
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
            stopStreamingState();
            pushTrialEndedNoticeIfNeeded();
          }
        };
        waitQueue();
      }
    };

    xhr.onerror = () =>
      failStream('Không thể kết nối đến server. Kiểm tra lại mạng.');

    xhr.ontimeout = () => failStream('Hết thời gian chờ. Thử lại sau.');

    xhr.timeout = 60000;
    xhr.send(
      JSON.stringify({
        question: userText,
        history,
        // Đã mua HOẶC còn lượt dùng thử -> dùng model chất lượng cao.
        plan: canUsePremiumRef.current ? 'premium' : 'free',
        // Server lưu câu trả lời vào job này để app lấy lại được nếu bị HĐH
        // tạm dừng giữa lúc đang stream.
        jobId,
      }),
    );
  }, [enqueueChunk, scrollToBottom]);

  // Cho phép failStream tự gọi lại streamAIResponse (gửi lại câu hỏi) mà không
  // tạo vòng phụ thuộc trong useCallback.
  useEffect(() => {
    streamAIResponseRef.current = streamAIResponse;
  }, [streamAIResponse]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    Keyboard.dismiss();
    setInputText('');

    // Bỏ lời chào + các bubble thông báo (lỗi, hết lượt dùng thử) khỏi history
    // để LLM không coi chúng là nội dung hội thoại.
    const history = messages
      .filter(
        m =>
          m.id !== '0' &&
          !m.id.startsWith('err-') &&
          !m.id.startsWith('trial-'),
      )
      .map(m => ({ role: m.role, content: m.text }));

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    // Câu hỏi mới -> reset trạng thái lấy-lại-câu-trả-lời của câu trước.
    autoRetryRef.current = 0;
    leftAppDuringStreamRef.current = false;
    wentBackgroundRef.current = false;
    pendingRetryRef.current = null;

    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();
    streamAIResponse(text, history);
  }, [inputText, isStreaming, messages, streamAIResponse, scrollToBottom]);

  // Dừng hẳn câu trả lời đang chảy, giữ nguyên phần chữ đã hiện.
  const handleStopStreaming = useCallback(() => {
    // Cắt kết nối trước: không thì server vẫn đẩy tiếp và chữ vẫn chảy ra.
    try {
      xhrRef.current?.abort();
    } catch (_) {}
    xhrRef.current = null;

    // Bỏ luôn phần đã tải nhưng chưa kịp gõ ra: bấm dừng là dừng ĐÚNG chỗ đang
    // nhìn thấy, chứ không phải gõ nốt thêm một đoạn nữa.
    if (charTimerRef.current) {
      clearTimeout(charTimerRef.current);
      charTimerRef.current = null;
    }
    charQueueRef.current = [];
    lastFlushAtRef.current = 0;

    // Vô hiệu mọi việc đã hẹn của câu này: lấy lại câu trả lời từ server và gửi
    // lại tự động đều phải im, nếu không câu vừa dừng sẽ tự sống lại khi user
    // rời app rồi quay vào.
    requestSeqRef.current += 1;
    lastRequestRef.current = null;
    autoRetryRef.current = 0;
    leftAppDuringStreamRef.current = false;
    wentBackgroundRef.current = false;
    pendingRetryRef.current = null;
    forceResumeRef.current = null;

    setIsTyping(false);
    setIsStreaming(false);
    isStreamingRef.current = false;
  }, []);

  // Xoá sạch khung chat, huỷ stream đang chạy và quay về lời chào ban đầu.
  const handleResetChat = useCallback(() => {
    const doReset = () => {
      try {
        xhrRef.current?.abort();
      } catch (_) {}
      xhrRef.current = null;

      if (charTimerRef.current) {
        clearTimeout(charTimerRef.current);
        charTimerRef.current = null;
      }
      charQueueRef.current = [];
      charCountRef.current = 0;
      lastFlushAtRef.current = 0;
      lastVibrateAtRef.current = 0;
      assistantIdRef.current = null;
      // Không để câu cũ tự gửi lại sau khi user đã làm mới khung chat.
      lastRequestRef.current = null;
      autoRetryRef.current = 0;
      leftAppDuringStreamRef.current = false;
      wentBackgroundRef.current = false;
      pendingRetryRef.current = null;
      requestSeqRef.current += 1; // vô hiệu mọi việc đã hẹn của câu vừa xoá

      setIsTyping(false);
      setIsStreaming(false);
      isStreamingRef.current = false;
      setInputText('');
      setMessages(makeInitialMessages());

      autoScrollRef.current = true;
      Keyboard.dismiss();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 60);
    };

    Alert.alert(
      'Làm mới khung chat',
      'Toàn bộ đoạn hội thoại hiện tại sẽ bị xoá và bắt đầu lại từ đầu.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Làm mới', style: 'destructive', onPress: doReset },
      ],
    );
  }, []);

  const handleCopy = useCallback(
    text => {
      if (!text) return;
      Clipboard.setString(text);
      Vibration.vibrate(12);
      Toast.show({
        type: 'copyToast',
        text1: 'Đã sao chép',
        visibilityTime: 1500,
        autoHide: true,
        topOffset: 50 + insets.top,
      });
    },
    [insets.top],
  );

  const renderMessage = useCallback(
    ({ item }) => <MessageBubble item={item} onCopy={handleCopy} />,
    [handleCopy],
  );
  const keyExtractor = useCallback(item => item.id, []);

  // Chiều cao thật của hộp nhập đang nổi. Danh sách phải chừa đúng bấy nhiêu ở
  // đáy, nếu không scrollToEnd sẽ kéo dòng cuối chui xuống DƯỚI hộp.
  const [inputBarHeight, setInputBarHeight] = useState(INPUT_BAR_HEIGHT);
  const handleInputBarLayout = useCallback(e => {
    const h = Math.round(e.nativeEvent.layout.height);
    setInputBarHeight(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  // Phần màn hình bị bàn phím CHE THẬT (tính từ đáy khung chat). Đo trên cả hai
  // nền tảng: targetSdk 35+ bắt Android chạy edge-to-edge nên adjustResize không
  // còn co cửa sổ -> bàn phím đè thẳng lên nội dung. Máy Android cũ vẫn co cửa
  // sổ thì đáy khung chat đã nằm trên bàn phím -> phần che = 0, không cộng đôi.
  const rootRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, e => {
      const kbTop = e.endCoordinates?.screenY;
      // RN Android báo chiều cao bàn phím ĐÃ TRỪ thanh điều hướng, nhưng chạy
      // edge-to-edge thì bàn phím che luôn cả dải đó -> cộng lại, không thì hộp
      // nhập hụt đúng bấy nhiêu và bị che mất nửa.
      const kbHeight =
        (e.endCoordinates?.height || 0) +
        (Platform.OS === 'android' ? insets.bottom : 0);
      const apply = overlap => {
        setKeyboardHeight(overlap > 1 ? overlap : 0);
        // Mở bàn phím là sắp gõ câu mới -> kéo nội dung cuối lên trên hộp nhập.
        scrollToBottom(false);
      };
      if (!rootRef.current || kbTop == null) {
        apply(kbHeight);
        return;
      }
      rootRef.current.measureInWindow((_x, y, _w, h) => {
        apply(Math.max(0, Math.min(kbHeight, y + h - kbTop)));
      });
    });
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollToBottom, insets.bottom]);
  // Bàn phím lên thì thanh tab bị che, không cần chừa chỗ cho nó nữa.
  const bottomInset = keyboardHeight > 0 ? keyboardHeight : tabBarHeight;

  // Tin nhắn đầu tiên không được nằm dưới tiêu đề nổi.
  const headerPad =
    insets.top +
    TOP_BAR_HEIGHT +
    HEADER_FADE +
    (isPremium && expiryDate ? 18 : 0);

  const ListFooter = useCallback(
    () => (
      <>
        {isTyping && (
          <View style={[styles.messageRow, styles.messageRowAssistant]}>
            <TypingIndicator />
          </View>
        )}
        <View style={{ height: 12 }} />
      </>
    ),
    [isTyping],
  );

  return (
    <View ref={rootRef} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D14" />

      {/* Danh sách chiếm trọn màn hình và chạy XUYÊN qua thanh tiêu đề: phần
          đệm trên của contentContainer chỉ đủ để tin nhắn đầu tiên không bị
          che, cuộn lên thì thấy chữ lướt sau tiêu đề trong suốt. */}
      <FlatList
        ref={setListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerPad,
            paddingBottom: bottomInset + inputBarHeight + INPUT_BAR_GAP,
          },
        ]}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleUserScrollIdle}
        onMomentumScrollBegin={handleUserScrollActive}
        onMomentumScrollEnd={handleUserScrollIdle}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleListLayout}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      />

      {/* Hộp nhập NỔI trên danh sách: khung ngoài trong suốt, chỉ đúng cái hộp
          bo tròn là có nền, nên phần bị che đúng bằng hộp chứ không phải cả
          một dải ngang màn hình. */}
      <View
        pointerEvents="box-none"
        onLayout={handleInputBarLayout}
        style={[styles.inputBar, { bottom: bottomInset }]}
      >
        <View style={styles.inputRow}>
          {/* Làm mới hội thoại: đặt ở đầu bên kia của thanh nhập, đối diện nút
              gửi, để hai nút cân nhau và không bị bấm nhầm lẫn nhau. */}
          <TouchableOpacity
            style={styles.resetBtn}
            activeOpacity={0.7}
            onPress={handleResetChat}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={17} color="#8A8AA8" />
          </TouchableOpacity>
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
          />
          {/* Đọc câu hỏi bằng giọng nói. Tự ẩn nếu máy/bản build không có bộ
              nhận dạng, nên không cần kiểm tra gì ở đây. */}
          <MicButton
            value={inputText}
            onChangeText={setInputText}
            active={isFocused}
          />
          {/* Đang chảy chữ thì chính nút gửi biến thành nút dừng — bấm một
              lần là cắt hẳn câu trả lời, giữ lại phần đã hiện. */}
          {isStreaming ? (
            <TouchableOpacity
              style={[styles.sendBtn, styles.stopBtn]}
              onPress={handleStopStreaming}
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendBtn,
                inputText.trim() ? styles.sendBtnActive : styles.sendBtnInactive,
              ]}
              onPress={handleSend}
              activeOpacity={0.8}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={inputText.trim() ? '#fff' : '#3A3A58'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tiêu đề trong suốt, nổi trên danh sách. pointerEvents="box-none" để
          khoảng trống giữa tiêu đề và pill vẫn cuộn/chạm xuống được danh sách,
          chỉ hai đầu (icon trái, phím đăng ký phải) mới nhận chạm. */}
      <View
        pointerEvents="box-none"
        style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.topBarLeft}>
            <View style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
            {/* <Text style={styles.headerTitle}>Trợ lý Luật AI</Text> */}
          </View>

          <View style={styles.topBarRight}>
            {isPremium ? (
              <View style={styles.premiumPill}>
                <Ionicons name="diamond" size={12} color="#FFD479" />
                <Text style={styles.premiumPillText}>
                  Premium{planLabel ? ` · ${planLabel}` : ''}
                </Text>
              </View>
            ) : trialRemaining > 0 ? (
              // Máy mới cài: còn lượt dùng thử model premium.
              <TouchableOpacity
                style={styles.trialPill}
                activeOpacity={0.8}
                onPress={() => setPaywallVisible(true)}
              >
                <Ionicons name="gift" size={12} color="#7FE3A1" />
                <Text style={styles.trialPillText}>
                  Dùng thử {trialRemaining}/{trialTotal}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.freePill}
                activeOpacity={0.8}
                onPress={() => setPaywallVisible(true)}
              >
                <Text style={styles.freePillText}>Bản Free</Text>
                <View style={styles.upgradeChip}>
                  <Ionicons name="sparkles" size={11} color="#fff" />
                  <Text style={styles.upgradeChipText}>Nâng cấp</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isPremium && expiryDate && (
          <Text style={styles.expiryText}>
            Hiệu lực đến {expiryDate.toLocaleDateString('vi-VN')}
          </Text>
        )}
      </View>


      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
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

  // Tiêu đề KHÔNG phủ nền đặc kín: nền chuyển tuyến tính từ đặc ở trên xuống
  // trong suốt hoàn toàn ở dưới. Tin nhắn cuộn lên là mờ dần rồi khuất hẳn,
  // không bị cắt ngang một nhát ở mép thanh.
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: HEADER_FADE,
    experimental_backgroundImage:
      // Chỉ dải trên cùng là đặc kín (10% chiều cao khối), rồi loang tuyến tính
      // một mạch tới mép dưới: hàng icon/pill nằm GIỮA đoạn loang nên nhìn
      // xuyên qua được. Giữ nguyên RGB nền, chỉ hạ alpha, để đoạn loang không
      // bị ngả xám.
      'linear-gradient(to bottom, rgba(13,13,20,1) 0%, rgba(13,13,20,1) 10%, rgba(13,13,20,0) 100%)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Nằm trong inputRow, đối xứng với sendBtn -> cùng kích thước 36.
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#12251A',
    borderWidth: 1,
    borderColor: '#2C4A38',
  },
  trialPillText: { color: '#7FE3A1', fontSize: 12, fontWeight: '700' },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,212,121,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,212,121,0.35)',
  },
  premiumPillText: { color: '#FFD479', fontSize: 12, fontWeight: '700' },
  freePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: 5,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252540',
  },
  freePillText: { color: '#9A9AB8', fontSize: 12, fontWeight: '600' },
  upgradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  expiryText: {
    color: '#5A5A78',
    fontSize: 11,
    paddingHorizontal: 16,
    paddingBottom: 4,
    textAlign: 'right',
  },

  listContent: { paddingHorizontal: 16, paddingTop: 12 },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.78,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#6C63FF', borderBottomRightRadius: 4 },
  // Không còn avatar chiếm chỗ bên trái nên bong bóng sát lề; chỉ nới bề
  // ngang vừa đủ để MÉP PHẢI đứng lại đúng chỗ cũ, không ăn hết màn hình.
  bubbleAssistant: {
    maxWidth: SCREEN_WIDTH * 0.82,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#252540',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAssistant: { color: '#E0E0F4' },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 10,
  },
  timestamp: { fontSize: 10 },
  timestampUser: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  timestampAssistant: { color: '#404060' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  copyBtnText: { fontSize: 11, color: '#7A7A9C', fontWeight: '600' },

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

  // Khung ngoài chỉ để định vị: trong suốt hoàn toàn, không nền, không nét
  // ngăn — tin nhắn chạy được xuống tận đáy màn hình phía sau nó.
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
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
    // Hai đầu đều có nút -> padding cân nhau.
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    // Hộp nổi trên nội dung -> cần đổ bóng để tách khỏi chữ chạy phía sau.
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
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
  stopBtn: {
    backgroundColor: '#E5484D',
    shadowColor: '#E5484D',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});