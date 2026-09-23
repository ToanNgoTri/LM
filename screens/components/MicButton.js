import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import {
  addListeners,
  cancel,
  isAvailable,
  isSupported,
  start,
} from '../../utils/speechService';
import { appendDictation } from '../../utils/dictation';

/**
 * Bao nhiêu mili-giây mới cập nhật chữ đang bay một lần. Bộ nhận dạng bắn kết
 * quả tạm rất dày; đẩy thẳng vào state sẽ làm ô nhập giật.
 */
const PARTIAL_THROTTLE_MS = 100;

/** Nối đoạn vừa đọc vào chữ cũ, không đụng tới dấu câu. */
function appendPlain(existing, spoken) {
  const base = (existing || '').replace(/\s+$/, '');
  const text = (spoken || '').trim();
  if (!text) return base;
  return base ? `${base} ${text}` : text;
}

/**
 * Nút đọc chính tả cho ô nhập câu hỏi của Chat AI.
 *
 * Chữ hiện dần ngay trong lúc nói (kết quả tạm) và phiên nghe không tự tắt sau
 * vài giây im lặng — nói bao lâu cũng được cho tới khi bấm dừng. Khác bản ở
 * ppv2: ở đây đọc là NỐI TIẾP vào câu hỏi đang gõ dở chứ không xoá trắng ô, vì
 * người dùng hay gõ nửa câu rồi đọc nốt phần còn lại.
 *
 * Máy không có module native (bản build cũ) hoặc không có bộ nhận dạng thì nút
 * tự ẩn — màn hình không cần biết.
 */
export default function MicButton({
  value,
  onChangeText,
  disabled,
  // Màn hình còn đang được xem hay không. Chuyển tab mà quên bấm dừng thì
  // micro vẫn nghe ngầm -> phải tự huỷ phiên.
  active = true,
  size = 36,
}) {
  const [available, setAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);

  /** Độ lớn âm thanh: vẽ bằng Animated để khỏi render lại mỗi khung. */
  const level = useRef(new Animated.Value(0)).current;

  /** Chữ đã chốt trước đoạn đang nói — mốc để ghép kết quả tạm vào. */
  const segmentBase = useRef('');
  const partialTimer = useRef(null);
  const pendingPartial = useRef(null);
  /** Đang là phiên nghe của nút này (để bỏ qua sự kiện rơi rớt của phiên cũ). */
  const owning = useRef(false);
  /**
   * Props do màn hình truyền vào thường là arrow tạo mới mỗi lần render. Giữ
   * qua ref để việc đăng ký listener native chỉ chạy đúng một lần.
   */
  const emit = useRef({ onChangeText, value });

  useEffect(() => {
    emit.current = { onChangeText, value };
  }, [onChangeText, value]);

  useEffect(() => {
    let cancelled = false;
    if (!isSupported()) return undefined;
    isAvailable().then(ok => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearPartialTimer = useCallback(() => {
    if (partialTimer.current) {
      clearTimeout(partialTimer.current);
      partialTimer.current = null;
    }
    pendingPartial.current = null;
  }, []);

  const finish = useCallback(() => {
    clearPartialTimer();
    owning.current = false;
    setRecording(false);
    setStarting(false);
    level.setValue(0);
  }, [clearPartialTimer, level]);

  useEffect(() => {
    if (!isSupported()) return undefined;

    const remove = addListeners({
      onStart: () => setStarting(false),
      onPartial: text => {
        if (!owning.current) return;
        // Gom lại: chỉ vẽ tối đa 10 lần/giây, và luôn vẽ bản mới nhất.
        pendingPartial.current = text;
        if (partialTimer.current) return;
        partialTimer.current = setTimeout(() => {
          partialTimer.current = null;
          const latest = pendingPartial.current;
          pendingPartial.current = null;
          if (latest != null) {
            emit.current.onChangeText(
              appendDictation(segmentBase.current, latest),
            );
          }
        }, PARTIAL_THROTTLE_MS);
      },
      onFinal: text => {
        if (!owning.current) return;
        clearPartialTimer();
        segmentBase.current = appendDictation(segmentBase.current, text);
        emit.current.onChangeText(segmentBase.current);
      },
      onVolume: v => {
        if (owning.current) level.setValue(Math.min(1, v || 0));
      },
      onEnd: finish,
      onError: message => {
        const mine = owning.current;
        finish();
        if (mine) Alert.alert('Không nghe được', message);
      },
    });

    return () => {
      remove();
      clearPartialTimer();
      // Rời màn hình trong lúc đang nghe thì tắt hẳn micro.
      if (owning.current) {
        owning.current = false;
        cancel();
      }
    };
  }, [clearPartialTimer, finish, level]);

  /** Cắt phiên nghe và CẮT LUÔN đường sự kiện chảy vào ô nhập. */
  const stopNow = useCallback(() => {
    // Bỏ quyền nhận sự kiện TRƯỚC khi huỷ phiên: kết quả cuối và mẩu partial
    // còn nằm trong hàng đợi vẫn về sau lệnh huỷ, không chặn ở đây thì chữ vẫn
    // tiếp tục chảy vào ô sau khi người dùng đã bấm tắt.
    owning.current = false;
    clearPartialTimer();
    setRecording(false);
    setStarting(false);
    level.setValue(0);
    // cancel() thay vì stop(): stop() còn chờ máy chốt nốt đoạn đang nói nên
    // có lúc không bắn onEnd, phiên treo lại và micro vẫn mở.
    return cancel();
  }, [clearPartialTimer, level]);

  // Đổi tab / rời màn hình trong lúc đang nghe -> tắt micro luôn.
  useEffect(() => {
    if (active || !owning.current) return;
    stopNow();
  }, [active, stopNow]);

  const toggle = useCallback(async () => {
    if (recording) {
      await stopNow();
      return;
    }

    // Đọc là nối tiếp vào câu hỏi đang gõ dở, không xoá trắng ô.
    segmentBase.current = appendPlain(emit.current.value, '');
    owning.current = true;
    setStarting(true);
    try {
      const started = await start({ locale: 'vi-VN', punctuate: true });
      if (!started) {
        owning.current = false;
        setStarting(false);
        Alert.alert(
          'Chưa có quyền micro',
          'Hãy bật quyền micro cho ứng dụng trong Cài đặt để đọc câu hỏi bằng giọng nói.',
        );
        return;
      }
      setRecording(true);
    } catch (e) {
      owning.current = false;
      setStarting(false);
      Alert.alert('Không mở được micro', e?.message || 'Vui lòng thử lại.');
    }
  }, [recording, stopNow]);

  if (!isSupported() || !available) return null;

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={disabled || starting}
      activeOpacity={0.8}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        recording && styles.buttonRecording,
      ]}
    >
      {recording && (
        // Vòng sáng nở theo tiếng nói: người dùng thấy ngay là máy đang nghe.
        <Animated.View
          style={[
            styles.pulse,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: level.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6],
              }),
              transform: [
                {
                  scale: level.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.75, 1.2],
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {starting ? (
        <ActivityIndicator size="small" color="#E5484D" />
      ) : (
        <Ionicons
          // Không dùng 'stop' ở đây: nút gửi lúc đang stream cũng là hình vuông
          // 'stop' nền đỏ, hai nút nằm cạnh nhau sẽ y hệt nhau.
          name={recording ? 'mic-off' : 'mic'}
          size={18}
          color={recording ? '#fff' : '#8A8AA8'}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  buttonRecording: { backgroundColor: '#E5484D' },
  pulse: { position: 'absolute', backgroundColor: '#E5484D' },
});
