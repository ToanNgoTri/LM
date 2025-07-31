/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React from 'react';
// import {NavigationContainer} from '@react-navigation/native';
import StackNavigator from './navigators/AppNavigators';
import {createContext, useState} from 'react';
import {Provider} from 'react-redux';
import {store} from './redux/store';
// import dataOrg from './data/data.json';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// import * as Sentry from "@sentry/react-native";

const BoxInHomeScreen = createContext(); 
// const InfoDownloaded = createContext(); //
const RefOfHome = createContext(); //
// const RefOfSearchLaw = createContext(); //
// const RefOfSearchContent = createContext(); //


function App() {
  

  // Sentry.init({
  //   dsn: "https://a645dd4585aedcdd48ed6ec4b15587fc@o4508942714339328.ingest.us.sentry.io/4508942715977728",
  // });

  const [showBoxInHomeScreen, setShowBoxInHomeScreen] = useState(false);
  const updateShowBoxInHomeScreen = data => {
    setShowBoxInHomeScreen(data);
  };
  
  // const [info, setInfo] = useState({});
  // const updateInfo = data => {
  //   setInfo(data);
  // };

  const [homeRef, setHomeRef] = useState('');
  const updateHomeRef = data => {
    setHomeRef(data);
  };


  // const [searchLawRef, setSearchLawRef] = useState('');
  // const updatesearchLawRef = data => {
  //   setSearchLawRef(data);
  // };

  // const [searchContentRef, setSearchContentRef] = useState('');
  // const updateSearchContentRef = data => {
  //   setSearchContentRef(data);
  // };


  // const [linkLawRelated, setLinkLawRelated] = useState('');
  // const updateLinkLawRelated = data => {
  //   setLinkLawRelated(data);
  // };

  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
    <Provider store={store}>
      <BoxInHomeScreen.Provider value={{showBoxInHomeScreen, updateShowBoxInHomeScreen}}>
        <RefOfHome.Provider value={{homeRef, updateHomeRef}}>
      {/* <RefOfSearchLaw.Provider value={{searchLawRef, updatesearchLawRef}}>
      <RefOfSearchContent.Provider value={{searchContentRef, updateSearchContentRef}}> */}
            {/* <InfoDownloaded.Provider value={{info,updateInfo}}> */}
      {/* <SafeAreaProvider> */}
      {/* <SafeAreaView> */}
            <StackNavigator />
    {/* </SafeAreaView> */}
    {/* </SafeAreaProvider> */}
            {/* </InfoDownloaded.Provider> */}
{/* </RefOfSearchContent.Provider>
            </RefOfSearchLaw.Provider> */}
            </RefOfHome.Provider>
      </BoxInHomeScreen.Provider>
    </Provider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default (App);
export { BoxInHomeScreen,RefOfHome};
