"use client";

import {

 MapContainer,
 TileLayer,
 Marker,
 Circle,
 useMapEvents,
 useMap

} from "react-leaflet";

import { useState,useEffect } from "react";

import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({

 iconRetinaUrl:
 "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",

 iconUrl:
 "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",

 shadowUrl:
 "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",

});

export default function MapPicker({

 setLat,
 setLng,
 radius

}:{

 setLat:(v:string)=>void
 setLng:(v:string)=>void
 radius:number

}){

 const [position,setPosition] =
 useState<any>([-6.200000,106.816666]);

 // ambil GPS user
 useEffect(()=>{

  navigator.geolocation.getCurrentPosition(

   (pos)=>{

    const lat =
    pos.coords.latitude;

    const lng =
    pos.coords.longitude;

    setPosition([lat,lng]);

    setLat(lat.toString());
    setLng(lng.toString());

   },

   ()=>{

    console.log("gps tidak diijinkan");

   }

  );

 },[]);

 function LocationMarker(){

  const map = useMap();

  useEffect(()=>{

   map.setView(position,16);

  },[position]);

  useMapEvents({

   click(e){

    const lat =
    e.latlng.lat;

    const lng =
    e.latlng.lng;

    setPosition([lat,lng]);

    setLat(lat.toString());
    setLng(lng.toString());

   }

  });

  return(

   <>

    <Marker position={position}/>

    <Circle

     center={position}

     radius={radius || 100}

     pathOptions={{

      color:"green"

     }}

    />

   </>

  );

 }

 return(

  <MapContainer

   center={position}

   zoom={16}

   style={{

    height:"350px",
    width:"100%"

   }}

  >

   <TileLayer

    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

   />

   <LocationMarker/>

  </MapContainer>

 );
}