// src/pages/seller/products/ProductForm.jsx
import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import {
  Upload, Plus, X, Info, Settings, CheckCircle, Minus,
  Image as ImageIcon, Trash2, RefreshCw,
} from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "../../../styles/ProductCreation.css";
import { API_CONFIG, apiUrl } from "../../../config/api";
import { AuthContext } from "../../../contexts/AuthContext";
import { showToast } from "../../../utils/toast";

/* ====== Toàn bộ helper & constant giống Create (giữ nguyên) ====== */
const CATEGORY_VN = { Electronics:"Điện tử", Fashion:"Thời trang", Books:"Sách", Home:"Nhà cửa", Sports:"Thể thao", Beauty:"Làm đẹp", Toys:"Đồ chơi", Automotive:"Ô tô - Xe máy", Health:"Sức khoẻ", Grocery:"Tạp hoá", SecondHand:"Đồ cũ", All:"Tất cả" };
const labelCategoryVN = (n)=>CATEGORY_VN[n]||n;
const BASELINE_TEMPLATE=[{name:"Màu sắc",values:["Đen","Trắng"]},{name:"Kích cỡ",values:["M","L"]}];
const DEFAULT_TEMPLATES={ Fashion:[{name:"Màu sắc",values:["Be","Đen"]},{name:"Kích cỡ",values:["M","L"]}], Electronics:[{name:"Phiên bản",values:["Tiêu chuẩn","Pro"]},{name:"Màu sắc",values:["Đen","Bạc"]}], Sports:[{name:"Kích cỡ",values:["M","L"]},{name:"Màu sắc",values:["Đen","Đỏ"]}], Beauty:[{name:"Dung tích",values:["50ml","100ml"]},{name:"Mùi hương",values:["Fresh","Floral"]}], Toys:[{name:"Màu sắc",values:["Hồng","Vàng"]},{name:"Chất liệu",values:["Nhựa","Gỗ"]}], Books:[{name:"Loại bìa",values:["Bìa mềm","Bìa cứng"]},{name:"Ngôn ngữ",values:["Việt","Anh"]}], Home:[{name:"Kích thước",values:["S","M"]},{name:"Màu sắc",values:["Trắng","Ghi"]}], Automotive:[{name:"Dòng xe",values:["Xe máy","Ô tô"]},{name:"Màu sắc",values:["Đen","Bạc"]}], Health:[{name:"Quy cách",values:["Hộp 10","Hộp 30"]},{name:"Dạng",values:["Viên","Bột"]}], Grocery:[{name:"Khối lượng",values:["250g","500g"]},{name:"Vị",values:["Nguyên bản","Ít đường"]}], SecondHand:[{name:"Tình trạng",values:["Mới 100%","Like New"]},{name:"Phụ kiện",values:["Đầy đủ","Thiếu hộp"]}], };
const defaultOptionNameByCategory=(en)=>DEFAULT_TEMPLATES[en]?.[0]?.name||"Phân loại";
const ALLOWED_MIME=["image/jpeg","image/png"];
const ALLOWED_EXT=["jpg","jpeg","png"];
const MAX_FILE_SIZE=2*1024*1024, WARN_FILE_SIZE=800*1024, RECOMMENDED_DIM="1024×1024", MAX_IMAGES=10;
const MAX_NAME_WORDS=20, MAX_WORD_LEN=7, MAX_OPTIONS=3, OPTION_VALUE_CHAR_LIMIT=20;
const STEP2_TOUR_SEEN_KEY="create_product_step2_tour_seen_v2";
const DRAFT_KEY = null; // Không lưu nháp khi edit; khi create có thể truyền key khác nếu muốn.

const getExt=(name="")=>{const dot=name.lastIndexOf(".");return dot>=0?name.slice(dot+1).toLowerCase():"";};
const isColorName=(s="")=>s.toLowerCase().includes("màu")||s.toLowerCase().includes("color");
const findTooLongWord=(raw="")=>{const words=raw.trim().split(/\s+/).filter(Boolean);for(const w of words)if(w.length>MAX_WORD_LEN)return w;return"";};
const sanitizeName=(raw="")=>raw.replace(/\s+/g," ").trim().split(" ").filter(Boolean).slice(0,MAX_NAME_WORDS).join(" ");
const fileToDataURL=(file)=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file);});
const cartesian=(arrays)=>!arrays.length?[]:arrays.reduce((acc,cur)=>{const next=[];acc.forEach(a=>cur.forEach(b=>next.push([...a,b])));return next;},[[]]);

/* ===== Cell & Modal giống Create ===== */
function ImagePickerModal({open,onClose,images,previews,onPick,position}){ if(!open) return null;
  const style=position?{left:`${position.x}px`,top:`${position.y}px`,transform:"translate(-50%,-50%)"}:{left:"50%",top:"50%",transform:"translate(-50%,-50%)"};
  return(<div className="pc-modal"><div className="pc-modal-backdrop" onClick={onClose}/><div className="pc-modal-content" style={style}>
    <div className="pc-modal-head"><h4>Chọn ảnh từ thư viện</h4><button className="pc-order-mgmt-btn pc-ghost pc-btn-sm" onClick={onClose}><X size={16}/> Đóng</button></div>
    {images?.length?(<div className="pc-modal-grid">
      {images.map((_,i)=>(<button key={i} type="button" className="pc-modal-thumb" onClick={()=>{onPick(i);onClose();}} title={`Chọn ảnh #${i+1}`}><img src={previews[i]?.url} alt={previews[i]?.name||"img"}/><div className="pc-modal-thumb-name">{previews[i]?.name}</div></button>))}
    </div>):(<div className="pc-empty">Chưa có ảnh. Hãy tải ảnh ở Bước 1.</div>)}
  </div></div>);
}

const ValueCell=({isMediaOption,value,placeholder,imgPreview,onPickImage,onClearMedia,onChange,onCommit,onRemove,readOnly=false,})=>{
  const count=(value||"").length;
  return(<div className="pc-value-cell">
    {isMediaOption?(<button type="button" className="pc-thumb-pick" onClick={(e)=>onPickImage?.(e)} title="Chọn ảnh">
      {imgPreview?.url?(<>
        <img src={imgPreview.url} alt={imgPreview.name||"preview"}/>
        <span className="pc-thumb-close" title="Xoá gán ảnh" onClick={(ev)=>{ev.stopPropagation();onClearMedia?.();}}><X size={14}/></span>
      </>):(<div className="pc-thumb-placeholder"><ImageIcon size={16}/><span>Chọn ảnh</span></div>)}
    </button>):(<div className="pc-value-thumb pc-value-thumb--spacer"/>)}
    <div className="pc-value-input-wrap">
      <input type="text" className="pc-form-input pc-input-compact pc-value-input" value={value}
        onChange={(e)=>onChange(e.target.value.slice(0,OPTION_VALUE_CHAR_LIMIT))} onBlur={onCommit}
        onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();onCommit();}}} placeholder={placeholder} maxLength={OPTION_VALUE_CHAR_LIMIT} readOnly={readOnly}/>
      <div className="pc-value-meta">
        <span className="pc-counter">{count}/{OPTION_VALUE_CHAR_LIMIT}</span>
        <div className="pc-value-actions">
          <button type="button" className="pc-action-icon" onClick={onRemove} title="Xoá" disabled={!value}><Trash2 size={16}/></button>
        </div>
      </div>
    </div>
  </div>);
};

/* ====== Component dùng chung ====== */
export default function ProductForm({
  mode = "create",
  categories = [],
  initialData = null,          // { name, categoryId, description, images: [url], optionDefs, variants, mediaByOption }
  onSubmit,                    // async (payload, files) => void
  submitLabel = "Lưu",
  successText = "Lưu thành công",
  sellerIdExternal = "",       // nếu cần ép sellerId (create)
}) {
  const { authFetch } = useContext(AuthContext) || {};
  const [submitting,setSubmitting]=useState(false);
  const [productData,setProductData]=useState({
    name:"", categoryId:"", description:"",
    images:[],        // File[] hoặc mock từ URL (edit -> không upload lại)
    optionDefs: BASELINE_TEMPLATE.map(o=>({...o})),
    variants:[],
    mediaByOption:[],
  });
  const [imgPreviews,setImgPreviews]=useState([]);  // {url,name,size,type}[]
  const [imagesB64,setImagesB64]=useState([]);      // chỉ dùng cho create (nháp)
  const [nameErr,setNameErr]=useState("");
  const [step2Err,setStep2Err]=useState("");
  const [pickerOpen,setPickerOpen]=useState(false);
  const [pickerBind,setPickerBind]=useState(null);
  const [pickerPos,setPickerPos]=useState(null);
  const [optionValueInputs,setOptionValueInputs]=useState({});
  const step2Ref=useRef(null);
  const baselineRef=useRef(BASELINE_TEMPLATE.map(o=>({...o})));

  // mediaKey: luôn đẩy “Màu sắc” lên đầu khi có
  const pickMediaKey=(opts)=>((opts||[]).find(o=>isColorName(o.name||""))||(opts||[])[0])?.name||"";
  const [mediaKey,setMediaKey]=useState(pickMediaKey(productData.optionDefs));

  // ===== Prefill khi edit =====
  useEffect(()=>{ if(mode!=="edit"||!initialData) return;
    const {name,categoryId,description,images,optionDefs,variants,mediaByOption}=initialData;

    const previews=(images||[]).map((u,idx)=>({url:u,name:`img_${idx+1}.jpg`,size:0,type:"image/jpeg"}));
    setImgPreviews(previews);
    // “images” để phục vụ gán chỉ số vào mediaByOption; khi submit edit ta sẽ chỉ gửi files mới (không lấy từ đây)
    setProductData({
      name:name||"", categoryId:categoryId||"", description:description||"",
      images: new Array(previews.length).fill(null), // placeholder kích thước (index)
      optionDefs: Array.isArray(optionDefs)&&optionDefs.length?optionDefs:BASELINE_TEMPLATE.map(o=>({...o})),
      variants: Array.isArray(variants)?variants:[],
      mediaByOption: Array.isArray(mediaByOption)?mediaByOption:[],
    });
    setMediaKey(pickMediaKey(optionDefs||[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode, JSON.stringify(initialData||{})]);

  // ===== Categories helpers =====
  const findCategoryById=(id)=>categories.find(c=>c.id===id);
  const getCategoryEnName=(id)=>findCategoryById(id)?.name||"";
  const buildOptionDefsFromCat=(catId)=>{
    const catName=getCategoryEnName(catId); const tpl=DEFAULT_TEMPLATES[catName];
    if(tpl&&tpl.length){
      const uniq=tpl.slice(0,MAX_OPTIONS).map(o=>({name:o.name,values:Array.from(new Set((o.values||[]).slice(0,30)))}));
      uniq.sort((a,b)=>(isColorName(b.name)?1:0)-(isColorName(a.name)?1:0));
      return uniq;
    }
    return [{name: defaultOptionNameByCategory(catName), values:[]}];
  };

  // Khi đổi danh mục → giống Create
  useEffect(()=>{ if(!productData.categoryId) return;
    const nextOpts=buildOptionDefsFromCat(productData.categoryId);
    setProductData(prev=>({...prev, optionDefs:nextOpts, mediaByOption:[], variants:[]}));
    setOptionValueInputs({}); setMediaKey(pickMediaKey(nextOpts));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[productData.categoryId, categories.length]);

  useEffect(()=>{ setMediaKey(pickMediaKey(productData.optionDefs)); },[productData.optionDefs]);

  // Bước 1 hợp lệ?
  const step1Valid=!!(productData.name.trim()&&productData.categoryId.trim());

  // Input change
  const handleInputChange=(field,value)=>{
    if(field==="name"){
      setProductData(prev=>({...prev,name:value}));
      const bad=findTooLongWord(value); setNameErr(bad?`Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự`:""); return;
    }
    setProductData(prev=>({...prev,[field]:value}));
  };

  // Thêm/sửa/xoá giá trị option (giữ nguyên code như Create)
  const addOptionValueFromInputByName=(optName)=>{ const raw=(optionValueInputs[optName]||"").slice(0,OPTION_VALUE_CHAR_LIMIT).trim(); if(!raw) return;
    const lower=raw.toLowerCase(); const idx=productData.optionDefs.findIndex(o=>o.name===optName); if(idx<0) return;
    const current=productData.optionDefs[idx].values||[];
    if(current.some(v=>String(v).trim().toLowerCase()===lower)){ showToast?.({title:"Giá trị trùng",text:`“${raw}” đã tồn tại.`,type:"warning"}); return; }
    const opts=[...productData.optionDefs]; opts[idx]={...opts[idx],values:[...(opts[idx].values||[]),raw]};
    setProductData(prev=>({...prev,optionDefs:opts})); setOptionValueInputs(prev=>({...prev,[optName]:""}));
  };
  const renameOptionValueByName=(optName,oldVal,newVal)=>{
    const trimmed=(newVal||"").slice(0,OPTION_VALUE_CHAR_LIMIT).trim(); if(!trimmed) return;
    const idx=productData.optionDefs.findIndex(o=>o.name===optName); if(idx<0) return;
    const lower=trimmed.toLowerCase(); const current=productData.optionDefs[idx].values||[];
    if(current.some(v=>v!==oldVal&&String(v).trim().toLowerCase()===lower)){ showToast?.({title:"Giá trị trùng",text:`“${trimmed}” đã tồn tại.`,type:"warning"}); return; }
    const opts=[...productData.optionDefs]; const replaced=current.map(v=>v===oldVal?trimmed:v); opts[idx]={...opts[idx],values:replaced};
    let newMedia=productData.mediaByOption;
    if(optName===mediaKey){ newMedia=(productData.mediaByOption||[]).map(m=>m.optionName===mediaKey&&m.optionValue===oldVal?{...m,optionValue:trimmed}:m); }
    setProductData(prev=>({...prev,optionDefs:opts,mediaByOption:newMedia}));
  };
  const removeOptionValueByName=(optName,value)=>{
    const idx=productData.optionDefs.findIndex(o=>o.name===optName); if(idx<0) return;
    const opts=[...productData.optionDefs]; opts[idx]={...opts[idx],values:(opts[idx].values||[]).filter(v=>v!==value)};
    let newMedia=productData.mediaByOption;
    if(optName===mediaKey){ newMedia=(productData.mediaByOption||[]).filter(m=>!(m.optionName===mediaKey&&m.optionValue===value)); }
    setProductData(prev=>({...prev,optionDefs:opts,mediaByOption:newMedia}));
  };

  // Tổ hợp variants giống Create
  const combinations=useMemo(()=>{ const active=(productData.optionDefs||[]).filter(o=>o.name&&(o.values||[]).length); if(!active.length) return [];
    const names=active.map(o=>o.name); const combos=cartesian(active.map(o=>o.values));
    return combos.map(arr=>{const obj={}; names.forEach((n,i)=>obj[n]=arr[i]); return obj;});
  },[productData.optionDefs]);
  useEffect(()=>{ if(!combinations.length){ setProductData(prev=>({...prev,variants:[]})); return; }
    const mapKey=(o)=>JSON.stringify(o);
    const existed=new Map((productData.variants||[]).map(v=>[mapKey(v.options||{}),v]));
    const next=combinations.map(opts=>{ const key=JSON.stringify(opts); const prev=existed.get(key);
      return {options:opts, price:prev?prev.price:0, compareAtPrice:prev?prev.compareAtPrice:0, quantity:prev?prev.quantity:0, available:prev?!!prev.available:true};
    });
    setProductData(prev=>({...prev,variants:next}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[productData.optionDefs]);

  const updateVariantField=(rowIdx,field,value)=>{
    const vts=[...productData.variants];
    if(field==="price"||field==="compareAtPrice"){ vts[rowIdx][field]=Number(String(value||"").replace(/[^\d]/g,""))||0; }
    else if(field==="quantity"){ vts[rowIdx][field]=Number(String(value??"").replace(/\D/g,""))||0; }
    else if(field==="available"){ vts[rowIdx][field]=!!value; }
    setProductData(prev=>({...prev,variants:vts}));
  };

  // Ảnh: cho create upload mới; cho edit cũng upload mới → filesNew; ảnh cũ hiển thị từ imgPreviews
  const [filesNew,setFilesNew]=useState([]);
  const [rejectedFiles,setRejectedFiles]=useState([]);
  const [flaggedIdxSet,setFlaggedIdxSet]=useState(new Set());
  const [flaggedMsgs,setFlaggedMsgs]=useState({});

  useEffect(()=>()=>{ imgPreviews.forEach(p=>p?.url&&p.url.startsWith("blob:")&&URL.revokeObjectURL(p.url)); },[imgPreviews]);

  const handleImagesUpload=async(e)=>{
    const incoming=Array.from(e.target.files||[]); if(!incoming.length) return;
    setRejectedFiles([]); setFlaggedIdxSet(new Set()); setFlaggedMsgs({});
    const totalCurrent = imgPreviews.length + filesNew.length;
    if(totalCurrent>=MAX_IMAGES){ alert(`Đã đủ tối đa ${MAX_IMAGES} ảnh.`); return; }
    const remain=MAX_IMAGES-totalCurrent;
    const valid=[], invalidNames=[];
    for(const f of incoming){
      if(valid.length>=remain){ invalidNames.push(`${f.name} (quá ${MAX_IMAGES} ảnh)`); continue;}
      const extOk=ALLOWED_EXT.includes(getExt(f.name)); const mimeOk=ALLOWED_MIME.includes(f.type);
      if(!(mimeOk||(!f.type&&extOk))){ invalidNames.push(`${f.name} (định dạng không hỗ trợ)`); continue; }
      if(f.size>MAX_FILE_SIZE){ invalidNames.push(`${f.name} (> 2048KB)`); continue; }
      valid.push(f);
    }
    if(valid.length){
      const previews=valid.map(f=>({url:URL.createObjectURL(f), name:f.name, size:f.size, type:f.type}));
      setFilesNew(prev=>[...prev,...valid]);
      setImgPreviews(prev=>[...prev,...previews]);
      if(mode==="create"){
        const b64s=await Promise.all(valid.map(fileToDataURL));
        setImagesB64(prev=>[...prev,...b64s]);
      }
    }
    if(invalidNames.length) setRejectedFiles(invalidNames);
  };

  const removeImageAt=(idx)=>{
    // idx trên imgPreviews – xoá luôn cả filesNew nếu thuộc phần “mới”
    const isNewIdx = idx >= (productData.images?.length || 0); // ảnh mới thêm vào cuối
    if(isNewIdx){
      const base=(productData.images?.length||0);
      const newIdx=idx-base;
      setFilesNew(prev=>{
        const cp=[...prev]; const removed=cp.splice(newIdx,1)[0];
        if(removed){ /* revoke handled via preview */ }
        return cp;
      });
    } else {
      // ảnh cũ (edit) – chỉ gỡ khỏi previews (không xóa thật khỏi server), và bỏ gán media nếu có
      setProductData(prev=>({
        ...prev,
        mediaByOption: (prev.mediaByOption||[]).filter(m=>String(m.image)!==String(idx))
      }));
    }
    setImgPreviews(prev=>{
      const cp=[...prev]; const removed=cp.splice(idx,1)[0];
      if(removed?.url?.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      return cp;
    });
  };

  // Map ảnh theo option value (giống Create) — dùng index theo imgPreviews
  const setMediaImageFor=(optName,optValue,imgIndexStr)=>{
    const list=[...(productData.mediaByOption||[])];
    const idx=list.findIndex(m=>m.optionName===optName&&m.optionValue===optValue);
    const item={optionName:optName, optionValue:optValue, image:String(imgIndexStr)};
    if(idx>=0) list[idx]=item; else list.push(item);
    setProductData(prev=>({...prev,mediaByOption:list}));
  };
  const getMediaImageIndexFor=(optName,optValue)=>{
    const m=(productData.mediaByOption||[]).find(x=>x.optionName===optName&&x.optionValue===optValue);
    return m?.image??"";
  };
  const clearMediaImageFor=(optName,optValue)=>{
    const list=(productData.mediaByOption||[]).filter(m=>!(m.optionName===optName&&m.optionValue===optValue));
    setProductData(prev=>({...prev,mediaByOption:list}));
  };

  // ===== Validate & Submit =====
  const VALIDATE_ENDPOINT=API_CONFIG?.endpoints?.fileValidateMany||"/file/s3/validate-many";
  const serverValidateImages=async()=>{
    if(filesNew.length===0) return {result:[]};
    const formData=new FormData(); filesNew.forEach(f=>formData.append("files",f,f.name));
    const res=await authFetch(apiUrl(VALIDATE_ENDPOINT),{method:"POST",body:formData});
    const text=await res.text(); let json={}; try{ json=text?JSON.parse(text):{}; }catch{ json={message:text}; }
    if(!res.ok) throw new Error(json?.message||`HTTP ${res.status}`); return json;
  };

  const validateBeforeSubmit=()=>{
    if(mode==="create" && !sellerIdExternal) return alert("Không tìm thấy Seller ID."), false;
    if(!productData.name?.trim()) { alert("Vui lòng nhập Tên sản phẩm."); return false; }
    const bad=findTooLongWord(productData.name); if(bad){ setNameErr(`Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự`); return false; }
    if(!productData.categoryId?.trim()) { alert("Vui lòng chọn Danh mục."); return false; }
    if((productData.variants||[]).length===0){ alert("Hãy thêm giá trị biến thể."); return false; }
    if(imgPreviews.length===0){ alert("Vui lòng chọn ít nhất 1 ảnh."); return false; }
    if(imgPreviews.length>MAX_IMAGES){ alert(`Tối đa ${MAX_IMAGES} ảnh.`); return false; }
    return true;
  };

  const scrollToStep2=()=>{ try{ step2Ref.current?.scrollIntoView({behavior:"smooth",block:"start"});}catch{} };

  const handleSubmit=async()=>{
    if(!validateBeforeSubmit()) return;

    // Ít nhất 1 biến thể có giá > 0 (giữ tiêu chí của Create để nhất quán UI)
    const hasAnyPrice=(productData.variants||[]).some(v=>Number(v.price)>0);
    if(!hasAnyPrice){ setStep2Err("Vui lòng nhập giá cho ít nhất 1 biến thể trước khi lưu."); scrollToStep2(); return; }

    // Kiểm duyệt ảnh mới (nếu có)
    try{
      setSubmitting(true);
      const val=await serverValidateImages();
      const list=Array.isArray(val?.result)?val.result:[]; const bad=list.filter(it=>it&&it.passed===false);
      if(bad.length>0){
        const idxSet=new Set(); const msgMap={};
        bad.forEach(b=>{ const i=Number(b.index); if(Number.isInteger(i)&&i>=0&&i<imgPreviews.length){ idxSet.add(i); msgMap[i]=b.reason||"Ảnh chứa nội dung không phù hợp."; }});
        setFlaggedIdxSet(idxSet); setFlaggedMsgs(msgMap); setSubmitting(false); return;
      }
    }catch(err){
      alert("Không thể kiểm duyệt ảnh tự động: "+(err?.message||"Lỗi không xác định")); setSubmitting(false); return;
    }

    // Lập payload giống Create, nhưng không đụng vào ảnh cũ — backend tự suy luận theo mediaByOption + filesNew
    const payload={
      ...(mode==="edit"?{id: initialData?.id}:{}),
      sellerId: sellerIdExternal || undefined,
      name: sanitizeName(productData.name),
      description: productData.description,
      status: initialData?.status || "AVAILABLE",
      categoryId: productData.categoryId,
      optionDefs: (productData.optionDefs||[]).filter(o=>o.name&&(o.values||[]).length).map(o=>({name:o.name,values:o.values})),
      variants: (productData.variants||[]).map(v=>({options:v.options||{}, price:Number(v.price||0), compareAtPrice:Number(v.compareAtPrice||0), quantity:Number(v.quantity||0), available:v.available!==false})),
      mediaByOption: (productData.mediaByOption||[]).filter(m=>m.optionName&&m.optionValue&&m.image!=null),
      // FRONT gửi thêm “mediaIndexMeaning”: client dùng index theo imgPreviews
      _clientMediaIndexBase: "imgPreviews",
    };

    await onSubmit?.(payload, filesNew);

    showToast?.({title: successText, type:"success", duration: 2600});
    setSubmitting(false);
  };

  /* ===== Tour nút manual ===== */
  const runStep2Tour=()=>{ const drv=driver({allowClose:true,animate:true,opacity:0.45,stagePadding:8});
    const STEPS=[{element:'[data-tour="step2-title"]',popover:{title:"Biến thể của sản phẩm",description:"Đặt tên biến thể (Màu sắc/Kích cỡ/Thông số…) và thêm giá trị.",side:"bottom",align:"start"}},{element:'[data-tour="value-rows"]',popover:{title:"Giá trị biến thể",description:"Nhập vào dòng rỗng; Enter/nhấp ra ngoài để lưu; luôn có 1 ô rỗng kế tiếp.",side:"bottom",align:"start"}}].filter(s=>{try{return !!document.querySelector(s.element);}catch{return false;}});
    if(STEPS.length){ drv.setSteps(STEPS); drv.drive(); }
  };
  const handleManualGuide=()=>{ localStorage.setItem(STEP2_TOUR_SEEN_KEY,"true"); runStep2Tour(); };

  // Sắp xếp mediaKey lên đầu
  const orderedOptionDefs=useMemo(()=>{ const src=productData.optionDefs||[]; const idx=src.findIndex(o=>o?.name===mediaKey); if(idx<=0) return src; const cp=[...src]; const [m]=cp.splice(idx,1); cp.unshift(m); return cp; },[productData.optionDefs,mediaKey]);

  const option1=orderedOptionDefs?.[0]?.name||""; const option2=orderedOptionDefs?.[1]?.name||"";
  const values1=orderedOptionDefs?.[0]?.values||[]; const values2=orderedOptionDefs?.[1]?.values||["—"];
  const findVariantIndex=(o1,o2)=>productData.variants.findIndex(v=>{const a=v.options||{}; return (o1?a[option1]===o1:true)&&(o2?a[option2]===o2:true);});

  // ======= Render =======
  return (
    <div className="pc-onepage">
      {/* Title */}
      <div className="pc-card" style={{marginBottom:16}}>
        <div className="pc-order-mgmt-head-row">
          <h1 className="pc-order-mgmt-title">
            <span className="pc-title-icon">🛒</span> {mode==="edit"?"Cập nhật sản phẩm":"Tạo sản phẩm mới"}
          </h1>
        </div>
      </div>

      {/* 1. Thông tin chung + ẢNH */}
      <div className="pc-card">
        <div className="pc-section-subtitle">
          <span className="pc-subtitle-icon"><Info/></span>
          <h3>1. Thông tin chung</h3>
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            <button type="button" onClick={handleManualGuide} className="pc-order-mgmt-btn pc-outline pc-btn-sm">❔ Hướng dẫn</button>
            <button type="button" onClick={()=>{ const baseline=baselineRef.current.map(o=>({name:o.name,values:[...(o.values||[])]})); setProductData(prev=>({...prev, optionDefs:baseline, mediaByOption:[], variants:[]})); setOptionValueInputs({}); setMediaKey(pickMediaKey(baseline)); showToast?.({title:"Khôi phục biến thể",text:"Đã khôi phục đúng bộ biến thể hỗ trợ ban đầu.",type:"info"}); }} className="pc-order-mgmt-btn pc-outline pc-btn-sm" title="Khôi phục biến thể hỗ trợ ban đầu"><RefreshCw size={16}/></button>
          </div>
        </div>

        <div className="pc-form-grid">
          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">Danh mục *</label>
            <select value={productData.categoryId} onChange={(e)=>handleInputChange("categoryId",e.target.value)} className="pc-form-select pc-input-compact">
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c=><option key={c.id} value={c.id}>{labelCategoryVN(c.name)}</option>)}
            </select>
          </div>

          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label">Tên sản phẩm (≤ {MAX_NAME_WORDS} từ, mỗi từ ≤ {MAX_WORD_LEN} ký tự) *</label>
            <input type="text" value={productData.name} onChange={(e)=>handleInputChange("name",e.target.value)}
              onBlur={(e)=>{const cleaned=sanitizeName(e.target.value); const bad=findTooLongWord(cleaned); setProductData(prev=>({...prev,name:cleaned})); setNameErr(bad?`Từ “${bad}” dài hơn ${MAX_WORD_LEN} ký tự`:"");}}
              placeholder="Nhập tên sản phẩm" className={`pc-form-input pc-input-compact ${nameErr?"pc-input-error":""}`} />
            {nameErr&&<div className="pc-field-error">{nameErr}</div>}
          </div>

          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label"><span className="pc-label-icon">📝</span>Mô tả</label>
            <textarea value={productData.description} onChange={(e)=>handleInputChange("description",e.target.value)} placeholder="Nhập mô tả chi tiết" className="pc-form-textarea pc-input-compact pc-descr-equal-height" spellCheck={false} autoCorrect="off" />
          </div>

          <div className="pc-form-group pc-full-width">
            <label className="pc-form-label"><span className="pc-label-icon">📸</span>Hình ảnh sản phẩm</label>
            <div className="pc-file-upload-area">
              <input type="file" multiple accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={handleImagesUpload} className="pc-file-input" />
              <div className="pc-file-upload-label">
                <Upload className="pc-upload-icon"/><span>Chọn hình ảnh hoặc kéo thả vào đây</span>
                <span>Hỗ trợ: <strong>JPG, JPEG, PNG</strong></span>
              </div>
            </div>
            <div className="pc-upload-note" style={{marginTop:6}}>
              <span className="pc-note-icon">i</span>
              <span>Gợi ý: <b>{RECOMMENDED_DIM}px</b>, dung lượng nên ≤ <b>{Math.round(WARN_FILE_SIZE/1024)}KB</b>, tối đa <b>{MAX_IMAGES}</b> ảnh.</span>
            </div>

            {imgPreviews.length>0&&(<>
              <div className="pc-uploaded-files">Đã chọn: {imgPreviews.length}/{MAX_IMAGES} hình ảnh</div>
              {rejectedFiles.length>0&&(<div className="pc-img-error" role="alert" style={{marginTop:8}}><strong>Các tệp không hợp lệ</strong>: {rejectedFiles.join(", ")}</div>)}
              <div className="pc-image-grid" style={{marginTop:10}}>
                {imgPreviews.map((p,idx)=>{
                  const flagged=flaggedIdxSet.has(idx); const msg=flaggedMsgs[idx];
                  return(<div key={idx} className={`pc-image-thumb ${flagged?"pc-flagged":""}`}>
                    <img src={p?.url} alt={p?.name||`img_${idx+1}`}/>
                    {flagged&&(<div className="pc-flag-badge" title={msg||"Ảnh vi phạm"}>Cảnh báo</div>)}
                    <div className="pc-thumb-meta">
                      <div className="pc-thumb-name" title={p?.name}>{p?.name}</div>
                      <div className="pc-thumb-size">{p?.size?Math.round((p.size||0)/1024)+" KB":"—"}</div>
                    </div>
                    <button onClick={()=>removeImageAt(idx)} className="pc-thumb-remove pc-order-mgmt-btn pc-btn-sm" type="button" aria-label="Xoá ảnh"><X size={16}/></button>
                  </div>);
                })}
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* 2. Tuỳ chọn & Biến thể */}
      <div className="pc-card" ref={step2Ref}>
        <div className="pc-section-subtitle" data-tour="step2-title">
          <span className="pc-subtitle-icon"><Settings/></span>
          <h3>2. Tuỳ chọn & Biến thể</h3>
        </div>

        {step2Err&&(<div className="pc-alert pc-alert-danger"><span>{step2Err}</span><button className="pc-alert-close" onClick={()=>setStep2Err("")} aria-label="Đóng"><X size={14}/></button></div>)}

        {(orderedOptionDefs||[]).map((opt)=>{
          const isMediaOption=opt.name===mediaKey; const optName=opt.name;
          return(<div key={optName} className="pc-option-block">
            <div className="pc-option-header pc-open">
              <div className="pc-option-header-left">
                <div className="pc-option-title">{optName||"Biến thể"}</div>
                {(!opt.values||opt.values.length===0)&&(<div className="pc-option-empty">Chưa có giá trị</div>)}
              </div>
              {(productData.optionDefs||[]).length>=2&&(
                <button type="button" onClick={()=>{
                  const next=(productData.optionDefs||[]).filter(o=>o.name!==optName);
                  setProductData(prev=>({...prev, optionDefs:next, mediaByOption:(prev.mediaByOption||[]).filter(m=>m.optionName!==optName)}));
                  setMediaKey(pickMediaKey(next));
                }} title="Xoá biến thể này" className="pc-order-mgmt-btn pc-delete-btn pc-btn-sm" style={{height:30}}><Minus size={16}/></button>
              )}
            </div>

            <div className="pc-option-editor" data-tour={isMediaOption?"value-rows":undefined}>
              <div className="pc-value-grid">
                {(opt.values||[]).map((v,i)=>{
                  const chosen=isMediaOption?getMediaImageIndexFor(optName,v):"";
                  const chosenIdx=chosen===""?-1:Number(chosen);
                  const preview=isMediaOption&&Number.isInteger(chosenIdx)&&chosenIdx>=0?imgPreviews[chosenIdx]:null;
                  return(<ValueCell key={`${optName}-${v}-${i}`} isMediaOption={isMediaOption} value={v} placeholder="Nhập" imgPreview={preview}
                    onPickImage={(e)=>{ if(!isMediaOption) return; setPickerBind({optionName:optName, optionValue:v}); setPickerPos({x:e.clientX,y:e.clientY}); setPickerOpen(true); }}
                    onClearMedia={()=>clearMediaImageFor(optName,v)}
                    onChange={(newVal)=>renameOptionValueByName(optName,v,newVal)} onCommit={()=>{}} onRemove={()=>removeOptionValueByName(optName,v)} />);
                })}
                {/* Ô rỗng chính */}
                <ValueCell isMediaOption={isMediaOption} value={optionValueInputs[optName]||""} placeholder="Nhập" imgPreview={null}
                  onPickImage={()=>{}} onClearMedia={()=>{}}
                  onChange={(val)=>setOptionValueInputs(p=>({...p,[optName]:(val||"").slice(0,OPTION_VALUE_CHAR_LIMIT)}))}
                  onCommit={()=>addOptionValueFromInputByName(optName)} onRemove={()=>setOptionValueInputs(p=>({...p,[optName]:""}))} />
                {(optionValueInputs[optName]||"").length>0&&(
                  <ValueCell isMediaOption={isMediaOption} value="" placeholder="Nhập" imgPreview={null}
                    onPickImage={()=>{}} onClearMedia={()=>{}} onChange={(val)=>setOptionValueInputs(p=>({...p,[optName]:(val||"").slice(0,OPTION_VALUE_CHAR_LIMIT)}))}
                    onCommit={()=>addOptionValueFromInputByName(optName)} onRemove={()=>{}} readOnly />
                )}
              </div>
            </div>
          </div>);
        })}

        {(productData.optionDefs||[]).length<MAX_OPTIONS&&(
          <div style={{marginTop:8,display:"flex",justifyContent:"center"}}>
            <button type="button" onClick={()=>setProductData(prev=>({...prev, optionDefs:[...prev.optionDefs,{name:"",values:[]}]}))} className="pc-order-mgmt-btn pc-outline pc-btn-sm">
              <Plus size={18}/> Thêm biến thể
            </button>
          </div>
        )}

        {/* Bảng tổ hợp */}
        <div className="pc-variants-table-wrap" style={{marginTop:14}}>
          {productData.variants.length===0?(
            <div className="pc-empty">Hãy thêm giá trị biến thể để sinh tổ hợp.</div>
          ):(
            <table className="pc-variants-table">
              <thead>
                <tr>
                  <th>{option1||"Tuỳ chọn 1"}</th>
                  <th>Chọn {option2||"Tuỳ chọn 2"}</th>
                  <th>* Giá</th>
                  <th>Giá so sánh</th>
                  <th>SL</th>
                </tr>
              </thead>
              <tbody>
                {(values1||[]).map(val1=>{
                  const rowCount=(values2||["—"]).length;
                  return (values2||["—"]).map((val2,j)=>{
                    const variantIdx=findVariantIndex(val1, option2?val2:null);
                    const v=productData.variants[variantIdx]||{};
                    const chosen=getMediaImageIndexFor(option1,val1);
                    const chosenIdx=chosen===""?-1:Number(chosen);
                    const preview=Number.isInteger(chosenIdx)&&chosenIdx>=0?imgPreviews[chosenIdx]:null;
                    return(<tr key={`${val1}-${j}`}>
                      {j===0&&(<td rowSpan={rowCount} className="pc-cell-primary">
                        <div className="pc-primary-wrap pc-primary-stack">
                          <div className="pc-primary-name">{val1}</div>
                          <div className="pc-primary-thumb-wrap">
                            <button type="button" className="pc-thumb-pick pc-thumb-pick--inline" title="Chọn ảnh cho nhóm này"
                              onClick={(e)=>{ setPickerBind({optionName:option1, optionValue:val1}); setPickerPos({x:e.clientX,y:e.clientY}); setPickerOpen(true); }}>
                              {preview?.url?(<>
                                <img src={preview.url} alt={preview.name||"preview"}/>
                                <button type="button" className="pc-thumb-close" title="Xoá gán ảnh" onClick={(ev)=>{ev.stopPropagation(); clearMediaImageFor(option1,val1);}}>
                                  <X size={14}/>
                                </button>
                              </>):(<div className="pc-thumb-placeholder"><ImageIcon size={16}/><span>Chọn ảnh</span></div>)}
                            </button>
                          </div>
                        </div>
                      </td>)}
                      <td className="pc-tight">{option2?(<span className="pc-badge">{val2}</span>):(<span className="pc-badge">—</span>)}</td>
                      <td className="pc-tight">
                        <input type="text" className="pc-form-input pc-input-compact"
                          value={v.price?String(v.price).replace(/\B(?=(\d{3})+(?!\d))/g,","):""}
                          onChange={(e)=>updateVariantField(variantIdx,"price",e.target.value)} placeholder="VD: 379000" />
                      </td>
                      <td className="pc-tight">
                        <input type="text" className="pc-form-input pc-input-compact"
                          value={v.compareAtPrice?String(v.compareAtPrice).replace(/\B(?=(\d{3})+(?!\d))/g,","):""}
                          onChange={(e)=>updateVariantField(variantIdx,"compareAtPrice",e.target.value)} placeholder="VD: 399000" />
                      </td>
                      <td className="pc-tight">
                        <input type="number" min={0} className="pc-form-input pc-input-compact"
                          value={v.quantity??0} onChange={(e)=>updateVariantField(variantIdx,"quantity",e.target.value)} placeholder="1000" />
                      </td>
                    </tr>);
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Xác nhận & Gửi */}
      <div className="pc-card">
        <div className="pc-section-subtitle">
          <span className="pc-subtitle-icon"><CheckCircle/></span>
          <h3>3. Xác nhận & Gửi</h3>
        </div>

        <div className="pc-summary-card">
          <div className="pc-summary-header"><span className="pc-summary-icon">📦</span><h4>Tóm tắt sản phẩm</h4></div>
          <div className="pc-summary-content">
            <div className="pc-summary-item"><span className="pc-summary-label">Tên</span><span className="pc-summary-value">{productData.name||"—"}</span></div>
            <div className="pc-summary-item"><span className="pc-summary-label">Danh mục</span><span className="pc-summary-value">
              {labelCategoryVN(findCategoryById(productData.categoryId)?.name)||"—"}
            </span></div>
            <div className="pc-summary-item"><span className="pc-summary-label">Ảnh</span><span className="pc-summary-value">{imgPreviews.length}/{MAX_IMAGES}</span></div>
            <div className="pc-summary-item"><span className="pc-summary-label">Biến thể</span><span className="pc-summary-value">{productData.variants.length}</span></div>
          </div>
        </div>

        <div className="pc-submit-section" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>window.history.back()} className="pc-order-mgmt-btn pc-ghost pc-btn-sm" disabled={submitting}><X size={16}/> Hủy</button>
          <button onClick={handleSubmit} className={`pc-order-mgmt-btn pc-confirm-bulk${submitting||!step1Valid?" pc-disabled":""}`}
            disabled={submitting||!step1Valid} title={!step1Valid?"Vui lòng điền Danh mục & Tên sản phẩm":""}>
            <Upload/>{submitting? (mode==="edit"?"Đang lưu...":"Đang gửi...") : (submitLabel || (mode==="edit"?"Lưu thay đổi":"Tạo sản phẩm"))}
          </button>
        </div>
      </div>

      {/* Modal chọn ảnh */}
      <ImagePickerModal open={pickerOpen} onClose={()=>setPickerOpen(false)} images={imgPreviews} previews={imgPreviews}
        onPick={(idx)=>{ if(pickerBind?.optionName&&pickerBind?.optionValue!=null){
          setMediaImageFor(pickerBind.optionName,pickerBind.optionValue,String(idx));
        }}} position={pickerPos} />
    </div>
  );
}
