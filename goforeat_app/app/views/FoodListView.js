import React, {Component} from 'react'
import {View,TouchableOpacity, SectionList,StyleSheet,RefreshControl} from 'react-native'
import {
  Container,
} from 'native-base';
import Image from 'react-native-image-progress';
//utils
import ToastUtil from '../utils/ToastUtil';
import GLOBAL_PARAMS, { em } from '../utils/global_params';
//api
import {getNewArticleList} from '../api/request';
import source from '../api/CancelToken';
//components
import ErrorPage from '../components/ErrorPage';
import BlankPage from '../components/BlankPage';
import CommonHeader from '../components/CommonHeader';
import ListFooter from '../components/ListFooter';
import Loading from '../components/Loading';
import Text from '../components/UnScalingText';
import SlideUpPanel from '../components/SlideUpPanel';
//language
import I18n from '../language/i18n';
//styles
import HomePageStyles from '../styles/homepage.style';

let requestParams = {
  status: {
    LOADING: 0,
    LOAD_SUCCESS: 1,
    LOAD_FAILED: 2,
    NO_MORE_DATA: 3
  },
  nextOffset: 0,
  currentOffset: 0
}

const { isIphoneX, bottomDistance, iPhoneXBottom, _winHeight, httpStatus:{LOADING, LOAD_FAILED, NO_DATA, NO_MORE_DATA} } = GLOBAL_PARAMS;

export default class FoodListView extends Component {
  static navigationOptions = ({screenProps}) => ({
    tabBarLabel: I18n[screenProps.language].weekMenu
  });
  state = {
    articleList: [],
    loadingStatus:{
      firstPageLoading: LOADING,
      pullUpLoading: LOADING,
    },
    refreshing: false,
    currentItem: '',
    i18n: I18n[this.props.screenProps.language]
  }

  componentDidMount() {
    this._onRequestNextPage(0);
  }

  componentWillReceiveProps(nextProps) {
    this._onRequestNextPage(0, nextProps.screenProps.place.id);
    requestParams.currentOffset = 0;
    requestParams.nextOffset = 0
  }

  componentWillUnmount() {
    source.cancel()
  }
  
  //common functions

  _onErrorRequestFirstPage = () => {
    this.setState({
      loadingStatus: {
        pullUpLoading: LOADING
      }
    })
    this._onRequestNextPage(0);
  }

  _onRequestNextPage = (offset, _id) => {
    
    let { place: {id} } = this.props.screenProps;
    __id = typeof _id != 'undefined' ? _id : id;
    let { articleList, i18n, refreshing } = this.state;
    getNewArticleList(offset, __id).then(data => {
      if (data.ro.respCode == '0000') {
        if(offset == 0) {
          this.setState({
            articleList: data.data.list,
            refreshing: false
          })
          return;
        }
        if(data.data.list.length === 0){
          requestParams.nextOffset = requestParams.currentOffset
          this.setState({
            articleList: articleList.concat(data.data.list),
            loadingStatus: {
              pullUpLoading:articleList.length  == 0 ? NO_DATA : NO_MORE_DATA
            },
            refreshing: false,
          })
          return
        }  
        this.setState({
          articleList: articleList.concat(data.data.list),
          loadingStatus: {
            pullUpLoading:LOADING
          },
          refreshing: false,
        })
        requestParams.currentOffset = requestParams.nextOffset
      }else{
        ToastUtil.showWithMessage(i18n.article_tips.fail.load)
        requestParams.nextOffset = requestParams.currentOffset
        this.setState({
          loadingStatus: {
            pullUpLoading: LOAD_FAILED
          },
          refreshing: false,
        })
      }
    },() => {
      requestParams.nextOffset = requestParams.currentOffset
      this.setState({
        loadingStatus: {
          pullUpLoading: LOAD_FAILED
        },
        refreshing: false,
      })
    })
  }

  _onRefreshToRequestFirstPageData() {
    this.setState({
      refreshing: true
    }, () => {
      requestParams.currentOffset = 0;
      this._onRequestNextPage(0);
    });
  }

  _onEndReach = () => {
    requestParams.nextOffset += 5;
    if(this.state.loadingStatus.pullUpLoading == NO_MORE_DATA) {
      return;
    }
    this._onRequestNextPage(requestParams.nextOffset)
  }

  _onErrorToRequestNextPage() {
    this.setState({
      loadingStatus:{
        pullUpLoading:LOADING
      }
    })
    requestParams.nextOffset += 5
    this._onRequestNextPage(requestParams.nextOffset)
  }

  _renderFoodListView = () => (
    <SectionList
      sections={[
        {title:'餐廳列表',data:this.state.articleList},
      ]}
      renderItem = {({item,index}) => this._renderFoodListItemView(item,index)}
      keyExtractor={(item, index) => index}
      onEndReachedThreshold={0.01}
      onEndReached={() => this._onEndReach()}
      ListFooterComponent={() => (<ListFooter loadingStatus={this.state.loadingStatus.pullUpLoading} errorToDo={() => this._onErrorToRequestNextPage()} {...this.props}/>)}
      refreshControl={
        <RefreshControl
          refreshing={this.state.refreshing}
          onRefresh={() => this._onRefreshToRequestFirstPageData()}
        />
      }
    />
  )

  _renderFoodListItemView = (item,index) => {
    if(typeof item === 'undefined') return;
    // console.log(123,item);
    return (
      <TouchableOpacity style={styles.articleItemContainer}
        onPress={() => {
          this.setState({
            currentItem: item
          }, () => {
            this.slideUpPanel._snapTo()    
          })
        }}>
        <Image source={{uri: item.thumbnail}} style={{width: em(124),height: em(160)}} resizeMode="cover"/>
        <View style={styles.articleItemDetails}>
          <View style={[styles.itemName, styles.marginBottom9]}>
            <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.foodTime}>{item.date}</Text>
          </View>
          <View style={{height: em(75),marginBottom: 12.5,}}>
            <Text style={styles.foodBrief} numberOfLines={5}>{item.brief}</Text>
          </View>
          <View style={{flexDirection: 'row'}}>
            <Text style={styles.foodUnit}>HKD</Text>
            <Text style={styles.foodPrice}>{item.price}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )}

  _renderFoodDetailsView() {
    let {name,date,thumbnail,brief,price} = this.state.currentItem;
    return (
      <SlideUpPanel ref={r => this.slideUpPanel = r}>
        <View>
          <Text style={HomePageStyles.panelTitle}>{name}</Text>
          <Image style={{height: em(250),marginTop: em(10),marginBottom: em(10)}} source={{uri: thumbnail}}/>
          <Text style={HomePageStyles.IntroductionFoodBrief} >{brief}</Text>
          <View style={HomePageStyles.AddPriceViewPriceContainer}>
            <Text style={HomePageStyles.AddPriceViewPriceUnit}>HKD</Text>
            <Text style={HomePageStyles.AddPriceViewPrice}>{price}</Text>
            <Text style={HomePageStyles.AddPriceViewOriginPrice}>{date}</Text>
          </View>
        </View>
      </SlideUpPanel>
    )
  }

  render() {
    let {i18n, articleList, pullUpLoading} = this.state;
    _bottomDistance = isIphoneX() ?  bottomDistance + iPhoneXBottom : bottomDistance;
    return (
    <Container style={{position:'relative'}}>
      <CommonHeader hasMenu headerHeight={em(76)} title={i18n.weekMenu} {...this.props}/>
        <View style={{marginTop:-em(75),height: _winHeight - _bottomDistance,minHeight: _winHeight - _bottomDistance}}>
          {
            articleList.length > 0
            ? this._renderFoodListView()
            : pullUpLoading == NO_DATA ? <BlankPage style={{marginTop: Platform.OS=='ios'? 50:110}} message={'T_T'+i18n.common_tips.no_data}/> : pullUpLoading == LOAD_FAILED ? <ErrorPage errorTips={i18n.common_tips.network_err} errorToDo={this._onErrorRequestFirstPage} {...this.props}/> : pullUpLoading == LOADING ?  <Loading /> : null
          }
        </View>  
        {this._renderFoodDetailsView()}  
      </Container>)
    }
  }

const styles = StyleSheet.create({
  articleItemContainer:{
    height: em(160),
    flex:1,
    borderRadius: 8,
    margin: 10,
    borderRadius :5,
    flexDirection: 'row',
    shadowColor: '#ededeb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  articleItemDetails: {
    padding: 17,
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ededeb',
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  itemName: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: em(18),
    color: '#111',
    fontWeight: '800',
    maxWidth: em(130)
  },
  foodTime: {
    fontSize: em(13),
    color: '#666',
    lineHeight: em(20)
  },
  foodBrief: {
    fontSize: em(11),
    color: '#999',
    textAlign: 'justify',
    lineHeight: 16
  },
  foodUnit: {
    fontSize: em(14),
    color: '#666',
    marginRight: em(5)
  },
  foodPrice: {
    fontSize: em(18),
    color: '#2a2a2a',
    lineHeight: em(18)
  },
  marginBottom9: {
    marginBottom: em(10),
  }
})
