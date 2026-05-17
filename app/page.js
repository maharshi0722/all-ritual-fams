"use client";

import { useMemo, useState } from "react";

export default function Home(){

const [search,setSearch]=useState("");

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


const filtered=useMemo(()=>{

return all.filter(img=>

img.toLowerCase()
.includes(search.toLowerCase())

);

},[search]);


return(

<main className="page">

<div className="hero">

<h1>

Ritual
Community
Wall

</h1>

<p>

{all.length}+ members

</p>


<input

placeholder="
Search name..."

value={search}

onChange={(e)=>
setSearch(
e.target.value
)
}

/>

</div>



<div className="grid">

{

filtered.map((img,i)=>(

<div
key={i}
className="card"
>

<img

src={img}

loading="lazy"



/>

</div>

))

}

</div>



<style jsx>{`

.page{

min-height:100vh;

background:
linear-gradient(
180deg,
#b695f5,
#8f4be2,
#511986
);

padding:40px;

}


.hero{

text-align:center;

margin-bottom:40px;

color:white;
}


.hero h1{

font-size:
clamp(
40px,
8vw,
90px
);

margin:0;
}


.hero p{

opacity:.8;

font-size:20px;
}



input{

margin-top:20px;

padding:
14px 20px;

border:none;

border-radius:
20px;

width:
min(
500px,
90%
);

font-size:16px;
}



.grid{

display:grid;

grid-template-columns:
repeat(
auto-fill,
minmax(
110px,
1fr
)
);

gap:16px;

}


.card{

aspect-ratio:1;

overflow:hidden;

border-radius:
18px;

background:
rgba(
255,
255,
255,
.08
);

backdrop-filter:
blur(8px);

transition:.2s;
}


.card:hover{

transform:
translateY(-5px);

}


.card img{

width:100%;
height:100%;

object-fit:cover;

display:block;
}



@media(
max-width:700px
){

.page{

padding:20px;
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