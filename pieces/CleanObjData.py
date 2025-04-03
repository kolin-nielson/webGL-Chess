import io
def main():
    fin = open("PiezasAjedrez.obj", "r")
    fout = io.open("PiezasAjedrezAdjusted.obj", 'w', newline='\n')
    #fout = open("PiezasAjedrezAdjusted.obj", "wb")
    big = 1000000
    minx = maxx = miny = maxy = minz = maxz = 0
    name = ""
    for line in fin:
        words = line.split()
        if len(words)==0:
            fout.write(line)
        elif words[0] == 'o':
            if name != "":
                print (name, minx, maxx, miny, maxy, minz, maxz)
            name = words[1]
            fout.write(line)
            
            minx =big
            maxx = -big
            miny = big
            maxy = -big
            minz = big
            maxz = -big
        elif words[0] == 'v':
            x = float(words[1])
            y = float(words[2])
            z = float(words[3])
                        
            overallScale = 12.1
            if name=="cube":
                x += -.074 / overallScale
                #y += -.28
                y += -0.022743
            if name=="queen" or name=="king":
                x *= .8
                z *= .8
            if name=="bishop":
                x *= .9
                z *= .9
                y *= 1.1
            x *= overallScale
            y *= overallScale
            z *= overallScale
            print("v %.6f %.6f %.6f" % (x,y,z), file=fout)
              
            if x < minx:
                minx = x
            if y < miny:
                miny = y
            if z < minz:
                minz = z            
            if x > maxx:
                maxx = x
            if y > maxy:
                maxy = y
            if z > maxz:
                maxz = z
        else:
            fout.write(line)
    print (name, minx, maxx, miny, maxy, minz, maxz)
    fin.close()
    fout.close()
    
main()

            
        