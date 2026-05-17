"use client";

import Image from "next/image";

export default function Home(){

const community=[];

for(let i=3062;i<=3270;i++){
community.push(`/images/IMG_${i}.jpg`);
}

const pngs=[];

for(let i=1;i<=101;i++){
pngs.push(`/images/${i}.png`);
}

const mods=[
"JEZ.JPG",
"JOSH.JPG",
"STEFAN.JPG",
"DUNKEN.JPG",
"ELIF.JPG",
"BUNSDEV.JPG",
"CLARIE.JPG",
"ERIC.JPG",
"FLASH.JPG",
"MAJORPROJECT.JPG",
"HINATA.JPG",
"KASH.JPG",
"MEISON.JPG",
"WHITESOCK.JPG",
].map(x=>`/images/${x}`);

const all=[
...mods,
...pngs,
...community
];


return(

<main className="page">

<div className="stars"/>


{/* NAVBAR */}

<nav className="navbar">

<div className="brand">

<Image
src="/logo.png"
width={28}
height={28}
alt=""
priority
className="logo"
/>

<span>

Ritual Wall

</span>

</div>

</nav>



{/* GALLERY */}

<section className="grid">

{

all.map((img,i)=>(

<div
key={i}
className="card"
>

<img
src={img}
loading="lazy"

onError={(e)=>{

e.currentTarget.style.display=
"none";

}}

/>

</div>

))

}

</section>



<style jsx>{`

.page{

min-height:100vh;

padding:20px;

background:
linear-gradient(
180deg,
#b695f5,
#8f4be2,
#511986
);

overflow:hidden;

position:relative;
}



/* stars */

.stars{

position:absolute;
inset:0;

background:
radial-gradient(
white 1px,
transparent 1px
);

background-size:
90px 90px;

opacity:.08;
}



/* navbar */

.navbar{

position:sticky;
top:15px;

z-index:100;

display:flex;
justify-content:flex-start;
align-items:center;

padding:
14px 22px;

margin-bottom:35px;

border-radius:
18px;

background:
rgba(
255,
255,
255,
0.08
);

backdrop-filter:
blur(18px);
}



.brand{

display:flex;
align-items:center;

gap:12px;

color:white;

font-size:22px;
font-weight:700;
}


.logo{

animation:
float 4s infinite;
}


@keyframes float{

50%{

transform:
translateY(-4px);

}

}



/* gallery */

.grid{

display:grid;

grid-template-columns:
repeat(
auto-fill,
minmax(
150px,
1fr
)
);

gap:18px;
}



.card{

aspect-ratio:1;

overflow:hidden;

border-radius:
20px;

background:
rgba(
255,
255,
255,
0.08
);

transition:
.25s;
}


.card:hover{

transform:
translateY(-8px)
scale(1.04);

}


.card img{

width:100%;
height:100%;

object-fit:cover;

display:block;
}



/* mobile */

@media(max-width:700px){

.grid{

grid-template-columns:
repeat(
3,
1fr
);

gap:10px;
}


.brand{

font-size:18px;
}

}

`}</style>

</main>

)

}