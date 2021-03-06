import React, { PureComponent } from "react";
import { View, StyleSheet, TextInput,Platform,Alert,TouchableOpacity,Image } from "react-native";
import {
  Container,
  Content,
  Button,
  Footer,
  Separator,
  ListItem,
  Icon,
  Input,
  Toast
} from "native-base";
import PopupDialog, {
  SlideAnimation,
  DialogTitle
} from "react-native-popup-dialog";
import Stripe from 'react-native-stripe-api';
//components
import BottomOrderConfirm from '../components/BottomOrderConfirm';
import CommonHeader from "../components/CommonHeader";
import BlankPage from "../components/BlankPage";
import Loading from "../components/Loading";
import LoadingModal from "../components/LoadingModal";
import ErrorPage from "../components/ErrorPage";
import PlacePickerModel from "../components/PlacePickerModel";
import Text from '../components/UnScalingText';
//utils
import Colors from "../utils/Colors";
import GLOBAL_PARAMS, { EXPLAIN_PAY_TYPE } from "../utils/global_params";
import ToastUtil from "../utils/ToastUtil";
import {getDeviceId} from "../utils/DeviceInfo";
//api
import {createOrder,confirmOrder,useCoupon} from '../api/request';
//component
import Divider from "../components/Divider";
//styles
import ConfirmOrderStyles from '../styles/confirmorder.style';
import CommonStyles from '../styles/common.style';
//language
import I18n from '../language/i18n';

const slideAnimation = new SlideAnimation({
  slideFrom: "bottom"
});

const PAY_TYPE = {
  cash: 1,
  apple_pay: 2,
  android_pay: 3,
  credit_card: 6,
  month_ticket: 7,
  wechat_pay: 4,
  ali_pay: 5
}

const api_key = 'pk_live_4JIHSKBnUDiaFHy2poHeT2ks';
const client = new Stripe(api_key);

export default class ConfirmOrderView extends PureComponent {
  _popupDialog = null;
  _input = null;
  timer = null;
  picker = null;
  state = {
    orderDetail: null,
    loading: true,
    loadingModal: false,
    isError: false,
    isExpired: false,
    isBottomShow: false,
    coupon: null,
    discountsPrice: 0,
    remark: '',
    showPlacePicker: false,
    i18n: I18n[this.props.screenProps.language],
    hasChangeDefaultPayment: null, // 记录默认选择支付方式是否被修改
  };

  componentDidMount() {
    this.timer = setTimeout(() => {
      this._createOrder();
      clearTimeout(this.timer);
    },500);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      hasChangeDefaultPayment: nextProps.screenProps.paytype
    });
    if(nextProps.screenProps.paytype == PAY_TYPE.month_ticket) {
      this.setState({
        discountsPrice: 0,
        coupon:null
      });
      this._input != null && this._input._root.clear();
      Toast.show({
        text: '*月票不能和優惠碼一齊使用',
        duration: 3000,
        type: 'warning',
        position: 'bottom'
      });
    }
    // console.log(this.state.orderDetail);
    // console.log(nextProps.screenProps.paytype);
    // this.setState({
    //   loading: true
    // },() => {
    //   this._createOrder();
    // });
  }

  _createOrder() {
    let {foodId,placeId,amount} = this.props.navigation.state.params;
    let {i18n} = this.state;
    createOrder(foodId,placeId,amount).then(
      data => {
        if (data.ro.respCode == '0000') {
          this.setState({
            loading: false,
            orderDetail: data.data,
            isBottomShow: true,
            isError: false
          });
        } else {
          if(data.ro.respCode == "10006" || data.ro.respCode == "10007") {
            this.props.screenProps.userLogout();
          }
          ToastUtil.showWithMessage(data.ro.respMsg);
          this.props.navigation.goBack()
          // Alert.alert(null
          //   , data.ro.respMsg
          //   , [
          //       {text: i18n.cancel},
          //       {text: i18n.confirm, onPress: () => this.props.navigation.goBack()}
          //   ]
          // );
          // alert(data.data.ro.respMsg);
          this.setState({
            loading: false,
            isExpired: true,
            expiredMessage: data.ro.respMsg
          });
        }
      },
      () => {
        this.setState({loading: false,isError: true});
        ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.get_order);
      }
    );
  };

  async _confirmOrder() {
    let {i18n, orderDetail: {defaultPayment},hasChangeDefaultPayment} = this.state;
    let {creditCardInfo} = this.props.screenProps;
    let token = null;
    defaultPayment = hasChangeDefaultPayment != null ? hasChangeDefaultPayment : defaultPayment;
    if (this.state.orderDetail === null) {
      ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.confirm_order);
      return;
    }
    switch(defaultPayment) {
      case PAY_TYPE.apple_pay:case PAY_TYPE.android_pay: {
        let _device = getDeviceId().split(",")[0];
        if(_device == 'iPhone6') {
          ToastUtil.showWithMessage(i18n.notSupport);
          return;
        }
        let _pay_res = new Promise((resolve,reject) => {this.handlePayWithAppleOrAndroid(resolve, reject,defaultPayment)})
        _pay_res.then(data => {
          this._confirmOrderWithToken(data);
        }).catch(err => ToastUtil.showWithMessage('取消了支付'));
      };break;
      case PAY_TYPE.credit_card: {
        this.setState({
          loadingModal: true
        });
        token = await client.createToken({
          number: creditCardInfo.card ,
          exp_month: creditCardInfo.time.substr(0,2), 
          exp_year: creditCardInfo.time.substr(3,2), 
          cvc: creditCardInfo.cvc,
          // address_zip: '12345'
       });
       if(!token.hasOwnProperty('id')) {
        ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.not_support)
        this.setState({
          loadingModal: false
        })
        return ;
      }
       token = token.id;
       this._confirmOrderWithToken(token);
      };break;
      case PAY_TYPE.cash:case PAY_TYPE.month_ticket: {
        this._confirmOrderWithToken(token);
      };break;
      default: {
        ToastUtil.showWithMessage('暫未支持該支付方式');
      };break;
    }
  };

  _confirmOrderWithToken(token) {
    let {hasChangeDefaultPayment,orderDetail:{totalMoney,orderId,defaultPayment},discountsPrice,coupon,remark} = this.state;
    totalMoney = totalMoney - discountsPrice > 0 ? totalMoney - discountsPrice : 0;
    defaultPayment = hasChangeDefaultPayment != null ? hasChangeDefaultPayment : defaultPayment;
    let {i18n} = this.state;
    let _appleAndAndroidPayRes = null;
    if(defaultPayment == PAY_TYPE.android_pay || defaultPayment == PAY_TYPE.apple_pay) {
      _appleAndAndroidPayRes = token;
      token = _appleAndAndroidPayRes.details.paymentToken;
    }
    confirmOrder(orderId,coupon,totalMoney,defaultPayment,token,remark).then(
      data => {
        this.setState({
          loadingModal: false
        })
        if (data.ro.respCode == '0000') {
          ToastUtil.showWithMessage(i18n.confirmorder_tips.success.order);
          if(defaultPayment == PAY_TYPE.android_pay || defaultPayment == PAY_TYPE.apple_pay) {
            _appleAndAndroidPayRes.complete('success');
          }
          this.props.navigation.navigate('MyOrderDrawer',{replaceRoute: true,confirm: true});
        } else {
          let _message = defaultPayment == PAY_TYPE.credit_card ? `,${i18n.confirmorder_tips.fail.check_card}` : '';
          ToastUtil.showWithMessage(data.ro.respMsg+_message);
        }
      },
      () => {
        ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.order);
        this.setState({
          loadingModal: false
        })
      }
    );
  }

  _useCoupon = () => {
    let {i18n, coupon, discountsPrice, orderDetail: {orderId}} = this.state;
    if(coupon == null) {
      ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.coupon_null);
      return ;
    }
    if(discountsPrice > 0) {
      ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.coupon_used);
      return;
    }
    useCoupon(coupon,orderId).then(data => {
      if(data.ro.respCode == '0000') {
        ToastUtil.showWithMessage(i18n.confirmorder_tips.success.coupon);
        this.setState({
          discountsPrice: data.data.money
        })
      } else {
        ToastUtil.showWithMessage(data.ro.respMsg);
        this._input._root.clear();
        this.setState({
          coupon: null
        })
      }
    }).catch(() => {
      () => {
        ToastUtil.showWithMessage(i18n.confirmorder_tips.fail.get_coupon);
      }
    })
  }

  _currentPayType = () => {
    let {hasChangeDefaultPayment, orderDetail: {defaultPayment}} = this.state;
    defaultPayment = hasChangeDefaultPayment != null ? hasChangeDefaultPayment : defaultPayment;
    return EXPLAIN_PAY_TYPE[defaultPayment][this.props.screenProps.language];
  }

  //private function

  handlePayWithAppleOrAndroid(resolve,reject,paytype) {
    let supportedMethods = ''
    let {orderDetail:{totalMoney,orderDetail},discountsPrice} = this.state;
    totalMoney = totalMoney - discountsPrice > 0 ? totalMoney - discountsPrice : 0;
    if(Platform.OS == 'ios' && paytype == PAY_TYPE.apple_pay) {
      supportedMethods = [
        {
          supportedMethods: ['apple-pay'],
          data: {
            merchantIdentifier: 'merchant.com.syun.goforeat',
            supportedNetworks: ['visa', 'mastercard'],
            countryCode: 'HK',
            currencyCode: 'HKD',
            paymentMethodTokenizationParameters: {
              parameters: {
                gateway: 'stripe',
                'stripe:publishableKey': 'pk_live_4JIHSKBnUDiaFHy2poHeT2ks',
                'stripe:version': '13.0.3'
              }
            }
          }
        }
      ];
    }
    if(Platform.OS == 'android' && paytype == PAY_TYPE.android_pay) {
      supportedMethods = [{
        supportedMethods: ['android-pay'],
        data: {
          supportedNetworks: ['visa', 'mastercard', 'amex'],
          currencyCode: 'USD',
          // environment: 'TEST', // defaults to production
          paymentMethodTokenizationParameters: {
            tokenizationType: 'NETWORK_TOKEN',
            parameters: {
              publicKey: 'pk_live_4JIHSKBnUDiaFHy2poHeT2ks'
            }
          }
        }
      }];
    }

    const details = {
      id: 'goforeat_pay',
      displayItems: [
        {
          label: orderDetail[0].foodName,
          amount: { currency: 'HKD', value: totalMoney }
        }
      ],
      total: {
        label: 'Goforeat',
        amount: { currency: 'HKD', value: totalMoney }
      }
    };
    const pr = new PaymentRequest(supportedMethods, details);

    pr
      .show()
      .then(paymentResponse => {
        // console.log(123);
        resolve(paymentResponse);
      })
      .catch(e => {
        // console.log(e)
        pr.abort();
        reject();
      });
  }

  _openDialog = () => {
    if(this.state.orderDetail === null) {
        ToastUtil.showWithMessage(this.state.i18n.confirmorder_tips.fail.order);
        return;
    }
    this._popupDialog.show(() => {
    });
  };

  _getCoupon = coupon => {
    this.setState({
      coupon
    })
  }

  _getRemark(val) {
    this.setState({
      remark: val
    })
  }

  _renderPopupDiaogView() {
      let {i18n} = this.state;
      let {orderDetail:{takeAddressDetail,totalMoney,takeTime,takeDate,takeAddress,orderDetail},discountsPrice} = this.state;
      totalMoney = (totalMoney - discountsPrice) > 0 ? totalMoney - discountsPrice : 0;
      return (<PopupDialog
      dialogTitle={<DialogTitle title={i18n.myOrder} />}
      width={GLOBAL_PARAMS._winWidth * 0.9}
      height={GLOBAL_PARAMS._winHeight * 0.65}
      ref={popupDialog => {
        this._popupDialog = popupDialog;
      }}
      dialogAnimation={slideAnimation}
      onDismissed={() => {
      }}
    >
      <Container>
        <Content>
          <ListItem last style={ConfirmOrderStyles.CommonListItem}>
            <Text style={CommonStyles.common_title_text}>{i18n.bookPhone}:</Text>
            <Text style={CommonStyles.common_title_text}>{this.props.screenProps.user}</Text>
          </ListItem>
          <Separator bordered>
            <Text style={CommonStyles.common_title_text}>{i18n.orderDetail}</Text>
          </Separator>
          <ListItem style={ConfirmOrderStyles.CommonListItem}>
            <Text style={CommonStyles.common_title_text}>{i18n.foodName}</Text>
            <Text style={[CommonStyles.common_title_text,Platform.OS=='android'?{maxWidth:150}:null]}>{orderDetail[0].foodName}</Text>
          </ListItem>
          <ListItem style={ConfirmOrderStyles.CommonListItem}>
            <Text style={CommonStyles.common_title_text}>{i18n.quantity}</Text>
            <Text style={CommonStyles.common_title_text}>{orderDetail[0].foodNum}</Text>
          </ListItem>
          <ListItem style={ConfirmOrderStyles.CommonListItem}>
            <Text style={CommonStyles.common_title_text}>{i18n.foodAddress}</Text>
            <Text tyle={CommonStyles.common_title_text}>{takeAddressDetail}</Text>
          </ListItem>
          <ListItem style={ConfirmOrderStyles.CommonListItem}>
            <Text style={CommonStyles.common_title_text}>{i18n.foodTime}</Text>
            <Text style={[CommonStyles.common_title_text,{maxWidth: 200}]} numberOfLines={1}>{takeDate}{" "}{takeTime}</Text>
          </ListItem>
          <ListItem style={ConfirmOrderStyles.CommonListItem} last>
            <Text style={CommonStyles.common_title_text}>{i18n.total}</Text>
            <Text style={[CommonStyles.common_title_text,{color:'#FF3348'}]}>HKD {totalMoney}</Text>
          </ListItem>          
        </Content>
        <Footer style={ConfirmOrderStyles.Footer}>
          <Button
            onPress={() => this._confirmOrder()}
            block
            style={ConfirmOrderStyles.ConfirmBtn}
          >
            <Text
              style={ConfirmOrderStyles.ConfirmBtnText}
            >
              {i18n.sendOrder}
            </Text>
          </Button>
        </Footer>
      </Container>
    </PopupDialog>
  )};

  _renderCouponBtnView() {
    return (
      <View style={[ConfirmOrderStyles.NewsInner,styles.commonMarginBottom]}>
        <Input 
          ref={t => this._input = t}
          clearButtonMode="while-editing"
          style={ConfirmOrderStyles.CouponInput}
          placeholderTextColor="#999999"
          placeholder={this.state.i18n.couponCode}
          multiline={false}
          autoFocus={false}
          returnKeyType="done"
          onChangeText={coupon => this._getCoupon(coupon)}
        />
        <TouchableOpacity onPress={this._useCoupon} style={ConfirmOrderStyles.CouponBtn}>
          <Text style={ConfirmOrderStyles.CouponText}>{this.state.i18n.use}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  _renderNewOrderView() {
    let {i18n} = this.state;
    let {orderDetail:{totalMoney,orderDetail,defaultPayment},hasChangeDefaultPayment,discountsPrice} = this.state;
    defaultPayment = hasChangeDefaultPayment != null ? hasChangeDefaultPayment : defaultPayment;
    totalMoney = totalMoney - discountsPrice > 0 ? totalMoney - discountsPrice : 0;
    return (
      <View style={styles.commonNewContainer}>
        <View style={[ConfirmOrderStyles.NewsInner,styles.commonMarginTop]}>
        <Text style={ConfirmOrderStyles.FoodName} numberOfLines={1}>{orderDetail[0].foodName}</Text>
        <Text style={ConfirmOrderStyles.MoneyUnit} numberOfLines={1}>HKD {orderDetail[0].foodMoney.toFixed(2)}</Text>
        </View>
        <View style={[ConfirmOrderStyles.CountView,styles.commonMarginBottom]}>
          <Text style={ConfirmOrderStyles.CountText}>{i18n.quantity}:</Text>
          <Text style={ConfirmOrderStyles.FoodNum}>{orderDetail[0].foodNum}</Text>
        </View>
        <Divider bgColor="#EBEBEB" height={1}/>
        {
          discountsPrice>0? <View style={[ConfirmOrderStyles.NewsInner,styles.commonMarginTop]}>
          <Text style={ConfirmOrderStyles.TotalText}>{i18n.discount}</Text>
          <View style={ConfirmOrderStyles.NewsInner}>
            <Text style={ConfirmOrderStyles.CouponUnit}>- HKD</Text>
            <Text style={ConfirmOrderStyles.CouponMoney} numberOfLines={1}>{discountsPrice.toFixed(2)}</Text>
          </View>
        </View> : null
        }
        <View style={[ConfirmOrderStyles.NewsInner,styles.commonMarginTop,styles.commonMarginBottom]}>
          <Text style={ConfirmOrderStyles.TotalText}>{i18n.total}</Text>
          <View style={ConfirmOrderStyles.NewsInner}>
            <Text style={ConfirmOrderStyles.MoneyUnit}>HKD</Text>
            <Text style={ConfirmOrderStyles.TotalMoney} numberOfLines={1}>{totalMoney.toFixed(2)}</Text>
          </View>
        </View>
        { defaultPayment == PAY_TYPE.month_ticket ? null : this._renderCouponBtnView()}
      </View>
    )
  }

  _renderNewDetailsView() {
    let {i18n} = this.state;
    let {orderDetail:{defaultPayment,takeAddressDetail,totalMoney,takeTime,takeDate,takeAddress,orderDetail}} = this.state;
    let _details_arr = [
      {title:i18n.fooddate,content: takeDate,hasPreIcon: false,fontColor:'#ff3448',canOpen: false,clickFunc:()=>{},disable: true},
      {title:i18n.foodAddress,content: takeAddress,hasPreIcon:true,fontColor:'#333333',canOpen:false,clickFunc:()=>{},disable: true},
      {title:i18n.foodTime,content: takeTime,hasPreIcon:false,fontColor:'#333333',canOpen:false,clickFunc:()=> {},disable: true},
      {title:i18n.payment,content:this._currentPayType(),hasPreIcon:false,fontColor:'#333333',canOpen:true,clickFunc:()=> {
        this.props.navigation.navigate('PayType',{
          from:'confirm_order'
        });
      }}
    ];
    return (
      <View style={[styles.commonNewContainer,{
        marginBottom: GLOBAL_PARAMS.isIphoneX() ? GLOBAL_PARAMS.iPhoneXBottom : 0,
      }]}>
        <Text style={[ConfirmOrderStyles.Title,styles.commonMarginBottom,styles.commonMarginTop]}>{i18n.foodInformation}</Text>
        {_details_arr.map((item,idx) => this._renderCommonDetailView(item,idx))}
        <View style={[styles.commonDetailsContainer,styles.commonMarginBottom]}>
          <Text style={{color:'#999999',marginBottom: 10}}>{i18n.remark}</Text>
          <Input allowFontScaling={false} style={ConfirmOrderStyles.Input} placeholderTextColor="#999" 
          placeholder="例如:加飯、少辣" clearButtonMode="while-editing" onChangeText={(val) => this._getRemark(val)}/>
        </View>
      </View>
    )
  }

  _renderCommonDetailView(item,idx) {
    let {i18n} = this.state;
    return (
      <View key={idx} style={[styles.commonDetailsContainer,styles.commonMarginBottom]}>
        <Text style={{color:'#999999',marginBottom: 10}}>{item.title}</Text>
        <TouchableOpacity disabled={item.disable} onPress={item.clickFunc} style={ConfirmOrderStyles.DetailText}>
          <View style={ConfirmOrderStyles.DetailInner}>
            {item.hasPreIcon ?<Image source={require('../asset/location.png')} style={{width: 18,height: 17,marginRight: 5}} resizeMode="contain"/> :null}
            <Text style={{fontSize: 18,color: item.fontColor,marginRight: item.hasPreIcon?20:0,}} numberOfLines={1}>{item.content}</Text>
          </View>
          {item.canOpen?<Icon name={item.title == i18n.payment ? 'ios-arrow-forward-outline' : 'ios-arrow-down-outline' } style={ConfirmOrderStyles.ArrowShow}/>:null}
        </TouchableOpacity>
      </View>
    )
  }

  _renderBottomConfirmView() {
    let {discountsPrice} = this.state;
    let {total} = this.props.navigation.state.params;
    let total_price = total - discountsPrice > 0 ? total - discountsPrice : 0;
    return (
      <BottomOrderConfirm isShow={this.state.isBottomShow} total={total_price}  btnMessage={this.state.i18n.orderNow} btnClick={this._openDialog} canClose={false}/>
    )
  }

  render() {
    let {i18n} = this.state;
    return (
      <Container>
        {this.state.orderDetail !== null ? this._renderPopupDiaogView() : null}
        <CommonHeader
          canBack
          title={i18n.detailPage}
          titleStyle={{ fontSize: 18, fontWeight: "bold" }}
          {...this["props"]}
        />
        {this.state.loading ? <Loading/> : null}
        {this.state.loadingModal ? <LoadingModal message={i18n.paying}/> : null}
        {this.state.isError ? (
          <ErrorPage errorToDo={() => this._createOrder()} errorTips={i18n.common_tips.reload} {...this.props}/>
        ) : null}
        <Content style={{ backgroundColor: '#efefef' }} padder>
          {this.state.isExpired ? (
            <BlankPage message={this.state.expiredMessage} style={{marginLeft: -10}}/>
          ) : null}
          {this.state.orderDetail != null ? this._renderNewOrderView() : null}
          {this.state.orderDetail !== null ? this._renderNewDetailsView() : null}
          <View style={{height: 65}}/>
          </Content>
          {this._renderBottomConfirmView()}
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  commonTitleText: {
    fontSize: 16,
    color: "#111111",
    fontWeight: "bold",
    fontFamily: "AvenirNext-UltraLightItalic"
  },
  commonDecText: {
    // fontFamily: 'AvenirNext-UltraLightItalic',
    color: Colors.fontBlack,
    fontWeight: "normal",
    fontSize: 16,
    // marginTop: 5,
    flex: 1
  },
  commonPriceText: {
    color: "#3B254B",
    fontWeight: "bold",
    fontSize: 16
    // marginTop: 5,
  },
  commonDetailText: {
    fontWeight: "700",
    color: Colors.fontBlack,
    fontSize: 20
    // fontFamily:'AvenirNext-Regular',
    // textShadowColor:'#C0C0C0',
    // textShadowRadius:2,
    // textShadowOffset:{width:2,height:2},
  },
  commonLabel: {
    letterSpacing: 2,
    fontWeight: "200",
    color: Colors.fontBlack
  },
  commonText: {
    fontSize: 18
  },
  commonNewContainer: {
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 5,
    shadowColor: '#efefef',
    shadowOpacity: 0.8,
    shadowOffset: {width: 0,height: 8},
    elevation: 3,
    marginBottom: 10,
    backgroundColor: Colors.main_white,
  },
  commonDetailsContainer: {
    justifyContent:'space-around',
    alignItems:'flex-start',
  },
  commonMarginTop: {
    marginTop: 15
  },
  commonMarginBottom: {
    marginBottom: 15
  }
});
