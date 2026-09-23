require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

# Module đọc chính tả của app, đóng gói thành pod riêng.
#
# Vì sao không để thẳng trong app target: SpeechRecognizer.mm là Objective-C++
# và kéo theo cả rừng header C++ của React Native. App target của bản mẫu RN
# hiện tại chỉ có Swift, nên nó KHÔNG được cấu hình để biên dịch/liên kết phần
# C++ đó — thiếu RCT_NEW_ARCH_ENABLED, thiếu luôn các thư viện tĩnh của React.
# Kết quả là hàng loạt ký hiệu facebook::react::* không tìm thấy lúc link.
#
# Để CocoaPods dựng thì install_modules_dependencies bên dưới rót đúng bộ cờ,
# đường dẫn header và phụ thuộc mà mọi native module khác đang dùng.
Pod::Spec.new do |s|
  s.name            = "LMSpeech"
  s.version         = package["version"]
  s.summary         = "Đọc chính tả bằng SFSpeechRecognizer cho lawMachine"
  s.license         = "MIT"
  s.authors         = "lawMachine"
  s.homepage        = "https://github.com/ToanNgoTri/LM"
  s.platforms       = { :ios => "15.1" }
  s.source          = { :path => "." }
  s.source_files    = "lawMachine/SpeechRecognizer.{h,mm}"

  # Khai báo ở đây thì khỏi phải chèn -framework vào OTHER_LDFLAGS của app.
  s.frameworks      = "Speech", "AVFoundation"

  # Spec cua TurboModule (AppSpecs.h) nam trong pod ReactCodegen do chinh
  # codegen sinh ra -> khai bao tuong minh cho chac duong dan header.
  s.dependency "ReactCodegen"

  install_modules_dependencies(s)
end
