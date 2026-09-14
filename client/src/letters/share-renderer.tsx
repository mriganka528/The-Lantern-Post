import { useEffect,useRef,useState } from 'react';
import { Image,Text,View } from 'react-native';
import { captureRef,releaseCapture } from 'react-native-view-shot';
import { File } from 'expo-file-system';
import type { PreparedShare,ShareCopy } from './share-contract';
import { paperTextures,paperBorders } from './antique-assets';
import { stationeryFont } from './stationery';
import { nativeShareFile } from './share-platform';
export function ShareRenderer({copy,ownerId,onReady,onError}:{copy:ShareCopy;ownerId:string;onReady:(p:PreparedShare)=>void;onError:()=>void}) {
  const [lines,setLines]=useState<string[]|null>(null);const [page,setPage]=useState(0);const [loaded,setLoaded]=useState(0);const [layout,setLayout]=useState(false);const ref=useRef<View>(null);const results=useRef<{uri:string;mimeType:string}[]>([]);const finished=useRef(false);const callbacks=useRef({onReady,onError});useEffect(()=>{callbacks.current={onReady,onError};},[onReady,onError]);
  const total=Math.max(1,Math.ceil((lines?.length??0)/22));const c=copy.preset.config;
  useEffect(()=>()=>{if(!finished.current) for(const item of results.current){const f=new File(item.uri);if(f.exists) f.delete();}},[]);
  useEffect(()=>{
    if(!lines || loaded<3 || !layout || copy.kind!=='TEXT') return;
    let active=true;let temporary:string|undefined;
    const frame=requestAnimationFrame(()=>{requestAnimationFrame(()=>{void (async()=>{
      try {temporary=await captureRef(ref,{format:'png',result:'tmpfile',width:1080,height:1500});if(!active)return;const bytes=await new File(temporary).bytes();if(!active)return;const file=await nativeShareFile(ownerId,bytes,'image/png');if(!active){const f=new File(file.uri);if(f.exists)f.delete();return;}results.current.push(file);
        if(page+1<total) setPage(page+1);else {const files=[...results.current];finished.current=true;callbacks.current.onReady({files:[],nativeFiles:files,ownerId,previewUri:files[0]?.uri,dispose:()=>{for(const item of files){const f=new File(item.uri);if(f.exists)f.delete();}}});}
      }catch{if(active)callbacks.current.onError();}finally{if(temporary)releaseCapture(temporary);}
    })();});});return()=>{active=false;cancelAnimationFrame(frame);};
  },[lines,loaded,layout,page,total,copy.kind,ownerId]);
  if(copy.kind!=='TEXT')return null;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{position:'absolute',left:-2000,top:0}, { pointerEvents: "none" }]}>
    {!lines && <Text allowFontScaling={false} style={[stationeryFont(c),{width:278,fontSize:12,lineHeight:15}]} onTextLayout={event=>{if(!lines)setLines(event.nativeEvent.lines.map(line=>line.text.replace(/\n$/,'')));}}>{copy.text.replace(/\n{3,}/g,'\n\n')}</Text>}
    <View ref={ref} collapsable={false} onLayout={()=>setLayout(true)} style={{width:360,height:500,backgroundColor:c.paperColor,padding:41,paddingTop:70}}>
      <Image source={paperTextures[c.texture]} onLoad={()=>setLoaded(n=>n+1)} onError={onError} style={{position:'absolute',inset:0,width:360,height:500}} />
      <Image source={paperBorders[c.motif]} onLoad={()=>setLoaded(n=>n+1)} onError={onError} style={{ position:'absolute', inset:0, width:360, height:500 }} tintColor={c.ribbonColor} />
      <Image source={require('../../assets/storybook/palace-crest.png')} onLoad={()=>setLoaded(n=>n+1)} onError={onError} style={{ position:'absolute', top:10, left:161, width:38, height:38 }} tintColor={c.ribbonColor} />
      <Text allowFontScaling={false} style={{position:'absolute',top:52,left:0,width:360,textAlign:'center',fontSize:6,color:c.inkColor,letterSpacing:1}}>FROM THE PALACE SCRIPTORIUM</Text>
      <Text allowFontScaling={false} style={[stationeryFont(c),{fontSize:12,lineHeight:15,color:c.inkColor}]}>{lines?.slice(page*22,page*22+22).join('\n')}</Text>
      <Text allowFontScaling={false} style={{position:'absolute',bottom:30,left:0,width:360,textAlign:'center',fontSize:8,color:c.inkColor}}>Lantern Post · {page+1} / {total}</Text>
    </View>
  </View>;
}
