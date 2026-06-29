import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BTN_WIDTH = 90;

export function ScreenToggle({ active }) {
  const navigation = useNavigation();

  function goTo(screen, side) {
    console.log('current active', active);
    console.log('navigate', screen);
    if (active === side) return;

    navigation.navigate(screen);
  }

  console.log(navigation.getState());
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.pill,
          {
            left: active === 'searchlaw' ? 3 : BTN_WIDTH + 3,
          },
        ]}
      />

      <TouchableOpacity
        style={styles.btn}
        onPress={() => goTo('SearchLaw', 'searchlaw')}
      >
        <Text
          style={[styles.label, active === 'searchlaw' && styles.labelActive]}
        >
          Tìm trích yếu
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => goTo('Search', 'search')}
      >
        <Text style={[styles.label, active === 'search' && styles.labelActive]}>
          Tìm nội dung
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 3,
    marginBottom: 2,
    overflow: 'hidden',
    position: 'relative',
    width: BTN_WIDTH * 2 + 6,
  },

  pill: {
    position: 'absolute',
    top: 3,
    width: BTN_WIDTH,
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
  },

  btn: {
    width: BTN_WIDTH,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 16,
    zIndex: 1,
  },

  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.75)',
  },

  labelActive: {
    color: '#333',
  },
});
