// Nội dung "Lời mở đầu" (chính sách sử dụng): hiện ở popup lần đầu mở app
// (App.js) và trong màn Cài đặt.
import { Text, useThemedStyles } from '../../theme';

export function PolicyParagraphs() {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Text style={styles.paragraph}>
        Các thông tin, nội dung và dịch vụ mà{' '}
        <Text style={styles.bold}>Sổ Tay Luật</Text> cung cấp chỉ mang tính
        chất tham khảo, nhằm đem lại cho người sử dụng cái nhìn tổng quát về các
        quy định pháp luật qua từng thời kỳ.
      </Text>

      <Text style={styles.paragraph}>
        Do các quy định pháp luật có thể thay đổi, bổ sung theo từng giai đoạn,
        người sử dụng khi áp dụng vào các trường hợp cụ thể cần tham khảo ý kiến
        của cơ quan nhà nước có thẩm quyền hoặc chuyên gia tư vấn pháp lý.
      </Text>

      <Text style={styles.paragraph}>
        Mặc dù đã nỗ lực hạn chế sai sót, các nội dung pháp luật được cung cấp
        vẫn có thể tồn tại lỗi đánh máy, trình bày hoặc sai lệch về hiệu lực
        pháp lý. Việc sử dụng ứng dụng đồng nghĩa với việc chấp nhận các thiếu
        sót này và Sổ Tay Luật không chịu trách nhiệm pháp lý đối với mọi thiệt
        hại phát sinh (nếu có).
      </Text>

      <Text style={[styles.paragraph, { marginBottom: 0 }]}>
        Ứng dụng được phát triển bởi tập thể{' '}
        <Text style={styles.bold}>Pixel Places Game</Text>, không đại diện cho
        bất kỳ cơ quan nhà nước nào. Xin chân thành cảm ơn sự tin tưởng và ủng
        hộ của quý người dùng.
      </Text>
    </>
  );
}

const makeStyles = c => ({
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: c.textSecondary,
    paddingHorizontal: 20,
    textAlign: 'justify',
    marginBottom: 12,
  },
  bold: { fontWeight: 'bold' },
});
