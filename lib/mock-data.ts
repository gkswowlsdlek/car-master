export const packages = [
  { id: "PKG-001", name: "버텍스 500 신차 패키지", price: 600000, items: ["버텍스 500 전면 및 측후면", "생활보호 PPF 5종", "신차검수", "유리막 코팅"] },
  { id: "PKG-002", name: "레이노 S9 프리미엄 패키지", price: 720000, items: ["레이노 S9 전면 및 측후면", "생활보호 PPF 5종", "신차검수", "발수 코팅"] },
  { id: "PKG-003", name: "솔라가드 퀀텀 패키지", price: 850000, items: ["솔라가드 퀀텀 전체 시공", "생활보호 PPF 5종", "신차검수", "세라믹 코팅"] },
];

export const shops = [
  ["SHOP-01","부산 오토랩","부산광역시 해운대구 센텀중앙로 97","1.2km",4.9,"AL"],
  ["SHOP-02","센텀 틴팅 스튜디오","부산광역시 해운대구 해운대로 620","2.4km",4.8,"CT"],
  ["SHOP-03","수영 카케어","부산광역시 수영구 광안해변로 215","4.1km",4.7,"SC"],
  ["SHOP-04","동래 모터스킨","부산광역시 동래구 중앙대로 1393","7.8km",4.8,"DM"],
  ["SHOP-05","대구 카프로","대구광역시 수성구 동대구로 110","88km",4.6,"CP"],
  ["SHOP-06","대전 오토필름","대전광역시 유성구 대학로 55","201km",4.7,"OF"],
  ["SHOP-07","광주 틴트웍스","광주광역시 서구 상무대로 920","210km",4.5,"TW"],
  ["SHOP-08","인천 카랩","인천광역시 남동구 인주대로 590","315km",4.8,"IC"],
  ["SHOP-09","서울 프리미엄틴트","서울특별시 강남구 언주로 640","328km",4.9,"SP"],
  ["SHOP-10","제주 오토케어","제주특별자치도 제주시 연삼로 120","340km",4.6,"JA"],
].map(([id,name,address,distance,rating,initials])=>({id:String(id),name:String(name),address:String(address),distance:String(distance),rating:Number(rating),initials:String(initials),services:["버텍스","신차검수","PPF","코팅"]}));

const states = ["일정 조율","결제 대기","예약 확정","입고 예정","입고 완료","시공 중","시공 완료","완료 확인","응답 대기","정산 완료"];
export const transactions = Array.from({length:10},(_,i)=>({id:`CM-2607${String(13-i).padStart(2,"0")}-${String(i+1).padStart(3,"0")}`,car:["그랜저 GN7","제네시스 GV80","기아 카니발","쏘렌토 MQ4"][i%4],area:["부산 해운대구","서울 강남구","대구 수성구"][i%3],shop:shops[i].name,package:packages[i%3].name.replace(" 신차 패키지","").replace(" 프리미엄 패키지",""),status:states[i],price:packages[i%3].price}));

export const dealers = ["김도윤","이서준","박지훈","최민서","정하늘"].map((name,i)=>({id:`DEALER-${i+1}`,name,agency:`${["한빛","케이","퍼스트","오토","드림"][i]} 리스렌트`}));
