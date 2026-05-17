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


{/* HEADER */}

<header className="hero">

<Image
src="/logo.png"
width={80}
height={80}
priority
alt=""
className="logo"
/>


<h1>

Ritual Wall

</h1>

</header>



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

padding:30px;

background:
linear-gradient(
180deg,
#b695f5,
#8f4be2,
#511986
);

position:relative;

overflow:hidden;
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



/* HEADER */

.hero{

display:flex;

flex-direction:column;

justify-content:center;
align-items:center;

margin-bottom:50px;

text-align:center;
}



.logo{

width:90px!important;
height:90px!important;

margin-bottom:18px;

animation:
float 4s ease infinite;

filter:
drop-shadow(
0 0 20px
rgba(
255,
255,
255,
0.2
)
);

}


@keyframes float{

50%{

transform:
translateY(-8px);

}

}



.hero h1{

margin:0;

font-size:
clamp(
54px,
8vw,
110px
);

font-weight:800;

line-height:.9;

letter-spacing:
-2px;

color:white;

text-shadow:
0 10px 30px
rgba(
0,
0,
0,
0.15
);

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
22px;

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



/* MOBILE */

@media(max-width:700px){

.page{

padding:18px;
}


.logo{

width:60px!important;
height:60px!important;
}


.hero h1{

font-size:48px;
}


.grid{

grid-template-columns:
repeat(
3,
1fr
);

gap:10px;
}

}

`}</style>

</main>

)

}