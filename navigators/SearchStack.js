import { createNativeStackNavigator } from '@react-navigation/native-stack';

const SearchStackNav = createNativeStackNavigator();

function SearchStack() {
  return (
    <SearchStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <SearchStackNav.Screen
        name="SearchLaw"
        component={Detail2}
      />

      <SearchStackNav.Screen
        name="Search"
        component={Detail1}
      />
    </SearchStackNav.Navigator>
  );
}