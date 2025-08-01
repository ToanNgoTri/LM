import {
  Platform,
  KeyboardAvoidingView,
  View,
  ActivityIndicator,
  Text,
  SafeAreaView
} from 'react-native';
import {useSelector} from 'react-redux';

import {useSafeAreaInsets} from 'react-native-safe-area-context';

import Detail5 from './Detail5';

export default function Detail() {
  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone
  const {loading} = useSelector(state => state['read']);

  return (
    <View style={{flex: 1, position:'relative'}}>
      {loading && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: 0.7,
            backgroundColor: 'black',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            // height:heightDevice
          }}>
          <Text
            style={{
              color: 'white',
              marginBottom: 15,
              fontWeight: 'bold',
            }}>
            Xin vui lòng đợi trong giây lát ...
          </Text>
          <ActivityIndicator size="large" color="white"></ActivityIndicator>
        </View>
      )}
      {Platform.OS == 'ios' ? (
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior="padding"
          keyboardVerticalOffset={-38 - insets.bottom / 2 }
        >
          <Detail5 />
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior="padding"
          keyboardVerticalOffset={-insets.bottom/2 - 38}
        >
          {/* <SafeAreaView style={{flex: 1}}> */}
            <Detail5 />
          {/* </SafeAreaView> */}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
