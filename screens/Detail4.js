// import {  StyleSheet, Text, View,ScrollView,Dimensions, TextInput, TouchableOpacity} from 'react-native';
// import firestore from '@react-native-firebase/firestore';
// import { useState, useEffect } from 'react';

// let ScreenHeight = Dimensions.get("window").height;

// export default function Detail() {

//     const [Article, setArticle] = useState('Chương ở đây')
//     const [Clause, setClause] = useState('Khoản ở đây')
//     const [Point, setPoint] = useState('Điểm ở đây')
//     const [Click, setClick] = useState(0);

//     const [Article1, setArticle1] = useState('')
//     const [Clause1, setClause1] = useState(' hành')
//     const [Point1, setPoint1] = useState('')
//     const [Add, setAdd] = useState(true);


//     // dùng cloud firestore database
//      //đây là xem
//     useEffect(()=>{
//       let random = Click % 3;

//   firestore()
//   .collection('project2')
//   .get()
//   .then( Query => {
//     let list = []
//     Query.forEach( (doc) => {
//       list.push({
//         Điều:doc.data().Article,     // để lấy tên document thì có thể thay .data() bằng .id
//         Khoản:doc.data().Clause,
//         Điểm:doc.data().Point,
//       })
//     });
//     setArticle(list[random].Điều);
//     setClause(list[random].Khoản);
//     setPoint(list[random].Điểm);
//   }
//   )
//     },[Click])

//       // hoặc dùng
  
//   // useEffect(()=>{
//   //  let userDocument = firestore().collection('project2')

//   //   userDocument.onSnapshot( (Query)=>{
//   //     let list =[];
//   //     Query.forEach( (doc) => {
//   //       list.push({
//   //         Chương:doc.data().Chapter,
//   //         Điều:doc.data().Article,
//   //         Khoảng:doc.data().Clause,
//   //         Điểm:doc.data().Point,
//   //       })
//   //     });
//   //     console.log(list);
//   //   })
//   // },[])




//   // đây là thêm
//     useEffect(()=>{
//       //đây là add với document random của máy 
//   // firestore()
//   // .collection('project2')
//   // .add({
//   //   name: 'Ada Lovelace',
//   //   age: 30,
//   // })
//   // .then( 
//   //   () => {
//   //     console.log('User added!');
//   //   }
//   // )

//   // hoặc thêm với doc tự chọn
//   firestore()
//   .collection('project2')
//   .doc('ABC')
//   .set({
//     Article: Article1,
//     Clause: Clause1,
//     Point: Point1,
//   })
//   .then( 
//     () => {
//       console.log('thêm với user ABC');
//     }
//   )
//     },[Add])

//     // tương tự với update thì set thay bằng update
//     // tương tự với delete thì set() thay bằng delete() 





//   return (

//     <ScrollView>
//       <View style={styles.container}>
//         <View style={styles.row}>
//           <Text style={styles.title}>
//           Điều:
//           </Text>
//           <Text style={styles.result}>
//               { Article }
//           </Text>
//         </View>

//         <View style={styles.row}>
//           <Text style={styles.title}>
//           Khoản:
//           </Text>
//           <Text style={styles.result}>
//               { Clause }
//           </Text>
//         </View>

//         <View style={styles.row}>
//           <Text style={styles.title}>
//             Điểm:
//           </Text>
//           <Text style={styles.result}>
//               { Point }
//           </Text>
//         </View>
//         <TouchableOpacity style={styles.btb} onPress={ ()=> setClick(Click+1)}> 
//           <Text style={{color:'white'}} >
//             Change
//           </Text>
//         </TouchableOpacity>
//       </View> 

// {/*------------------------------------------------------------------------------------------------*/}
//       <View style={styles.container}>
//         <View style={styles.row}>
//           <Text style={styles.title}>
//             Điều:
//           </Text>
//           <TextInput placeholder='Write here...' style={styles.result} value={Article1} onChangeText={(text) => setArticle1(text)}>
//           </TextInput>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.title} >
//             Khoản:
//           </Text>
//           <TextInput placeholder='Write here...' style={styles.result} value={Clause1} onChangeText={(num) => setClause1(num)}>
//           </TextInput>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.title} >
//             Điều:
//           </Text>
//           <TextInput placeholder='Write here...' style={styles.result} value={Point1} onChangeText={(num) => setPoint1(num)}>
//           </TextInput>
//         </View>
//         <TouchableOpacity style={styles.btb} onPress={ ()=> setAdd(!Add)}> 
//           <Text style={{color:'white'}} >
//             Thêm
//           </Text>
//         </TouchableOpacity>
//       </View>

//     </ScrollView>
    
    
//   );
// }

// const styles = StyleSheet.create({
//   container:{
//     display:'flex',
//     flex:1,
//     alignItems:'center',
//     justifyContent:'center',
//     height:ScreenHeight/4,
//     backgroundColor: 'orange',
//     flexDirection:'column',

//   },
//   row:{
//     display:'flex',
//     flexDirection:'row',
//     // justifyContent:'center',
//     // alignItems:'center',
//     marginBottom:10,
//   },
//   title:{
//     width:100,
//     color:'white',
//     textAlign:'center',
//     fontSize:17,
//   },
//   result:{
//     width:200,
//     backgroundColor:'white',
//     color:'black',
//     textAlign:'center',
//     justifyContent:'center',
//     fontSize:17,
//   },
//   btb:{
//     backgroundColor:'green',
//     color:'white',
//     width:50,
//     height:40,
//     display:'flex',
//     alignItems:'center',
//     justifyContent:'center',
//     borderRadius:5,
//     marginTop:10,
//     color:'white'
//   }
// });
