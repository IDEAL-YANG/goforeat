import React from 'react';
import PropTypes from 'prop-types';
import { View,StyleSheet,Image,TouchableOpacity } from 'react-native';
import GLOBAL_PARAMS from '../utils/global_params';
import LinearGradient from 'react-native-linear-gradient';
//styles
import CommonStyle from '../styles/common.style';
//components
import Text from './UnScalingText';
//language
import I18n from '../language/i18n';

const styles = StyleSheet.create({
  loadingContainer: {
    // position:'absolute',
    // top:0,
    // left:0,
    // flex:1,
    justifyContent: 'flex-start',
    zIndex:10000,
    backgroundColor: '#fff',
    height:GLOBAL_PARAMS._winHeight,
    paddingTop: 20,
    alignItems: 'center',
  },
  inner: {
    position:'relative'
  },
  image: {
    width: GLOBAL_PARAMS._winWidth,
    height: GLOBAL_PARAMS.heightAuto(320)
  },
  infoText: {
    position: 'absolute',
    width: GLOBAL_PARAMS._winWidth,
    bottom: GLOBAL_PARAMS.em(-20),
    zIndex: 100
  },
  text1: {
    fontSize: GLOBAL_PARAMS.em(22),
    color: '#111111',
    marginBottom: GLOBAL_PARAMS.em(12),
    fontWeight:'600',
    textAlign: 'center'
  },
  text2: {
    fontSize: GLOBAL_PARAMS.em(22),
    color:'#999999',
    fontWeight: '400',
    textAlign:'center'
  },
  refresh_btn: {
  },
  refresh_btn_inner:{
    marginTop: GLOBAL_PARAMS.em(60),
    ...CommonStyle.btn
  }
})

const ErrorPage = (props) => {
  return (
    <View style={[styles.loadingContainer,props.style]}>
      <View style={styles.inner}>
        <Image source={require('../asset/badnetwork.png')} style={styles.image} resizeMode="cover"/>
        <View style={styles.infoText}>
          <Text style={styles.text1}>{I18n[props.screenProps.language].common_tips.network_err}</Text>
          <Text style={styles.text2}>{I18n[props.screenProps.language].common_tips.reload_again}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => props.errorToDo()} style={styles.refresh_btn}>
        <LinearGradient colors={['#FF9F48','#FF4141']} start={{x:0.0, y:0.0}} end={{x:1.0,y: 0.0}} style={styles.refresh_btn_inner}>
          <Text style={{color:'#fff',fontSize:16}}>{I18n[props.screenProps.language].refresh}</Text>
        </LinearGradient>
      </TouchableOpacity>
    {/*<View style={{alignSelf:'center'}}>
      <TouchableOpacity style={{alignItems: 'center'}} onPress={() => props.errorToDo()}>
        {Platform.OS === 'android' ? (<Image source={{uri: 'notfound'}} style={{width: 80,height: 80}}/>) :
        (<Image source={{uri: '404'}} style={{width: 80,height: 80,marginBottom: 10,}}/>)}
        <Text style={{color:'#222',fontSize: 16}}>{props.errorTips}</Text>
      </TouchableOpacity>
  </View>*/}
    </View>
  )
}

ErrorPage.defaultProps = {
  errorTips:'Loading...',
  errorToDo: () => {return },
  style: {}
};

ErrorPage.propTypes = {
  errorTips:PropTypes.string,
  errorToDo:PropTypes.func,
  style: PropTypes.object
};

export default ErrorPage
